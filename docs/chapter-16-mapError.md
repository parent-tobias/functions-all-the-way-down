# Functions All the Way Down: Chapter 16
## Completing Task — `mapError` and Consistent Error Shapes

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

Chapter 15 ended with an honest admission: the Either → Task bridge collapsed two distinct error types — a missing URL parameter (a client mistake, HTTP 400) and a failed feed fetch (a server failure, HTTP 500) — into a single `fork` error handler that sent 500 for both. The problem was named, the solution was sketched, but the implementation was left for this chapter.

The solution is `mapError`. One method, one line, and it completes the symmetry that Task has been missing.

## The Gap in Task

Look at what Task already has:

```js
map:   fn => Task((reject, resolve) => fork(reject, x => resolve(fn(x)))),
chain: fn => Task((reject, resolve) => fork(reject, x => fn(x).fork(reject, resolve))),
fold:  (leftFn, rightFn) => Task((reject, resolve) => fork(
  err => resolve(leftFn(err)),
  x   => resolve(rightFn(x))
)),
```

Every method operates on the *resolved* path. `map` transforms a resolved value. `chain` sequences resolved values into new Tasks. `fold` handles both paths, but routes them both to `resolve`. The rejected path is only ever passed through unchanged or consumed by `fork`.

There's no method that transforms the *rejected* value without terminating the Task. That's the gap. `mapError` fills it:

```js
mapError: fn => Task((reject, resolve) => {
  fork(err => reject(fn(err)), resolve);
}),
```

Place it alongside `map` and the symmetry is complete:

```js
map:      fn => Task((reject, resolve) => fork(reject,              x => resolve(fn(x)))),
mapError: fn => Task((reject, resolve) => fork(err => reject(fn(err)), resolve)),
```

`map` transforms the resolved value, passes rejection through.
`mapError` transforms the rejected value, passes resolution through.
Neither terminates the Task. Both return a new Task that can be further composed.

## The Error Shape Problem

`mapError` is only useful if the errors arriving at `fork` have a consistent shape. In the original server, they didn't:

- `Either.fromNullable` produced a plain string on the Left: `'Missing url parameter'`
- `processFeed` rejected with a plain `Error` object: `err.message` to get the text

To send the correct HTTP status code, the `fork` error handler needed to know *which kind of error* it had received — but by the time it got there, that context was gone.

The fix requires two things: agree on an error shape, and ensure every error path produces that shape before reaching `fork`.

The shape: `{ status, message }`. A status code and a human-readable message, decided in the HTTP shell, where HTTP status codes belong.

```js
// Validation failure — decided at the entry point, in the shell
Either.fromNullable(url, { status: 400, message: 'Missing url parameter' })

// Fetch/parse failure — normalised by mapError before reaching fork
.mapError(err => ({ status: 500, message: `Error processing feed: ${err.message}` }))
```

The Either validation error already carries the right shape. The Task rejection arrives as an `Error` object — `mapError` converts it to the same shape before `fork` sees it. Both error paths are now uniform, and `fork` can destructure without any conditionals:

```js
.fork(
  ({ status, message }) => sendError(res, status, message),
  items => sendJSON(res, 200, items)
)
```

## Why the Error Shape Lives in the Shell

You might reasonably ask: is putting `{ status: 400 }` into an Either Left mixing HTTP concerns into a general-purpose type?

Either itself is unaffected — it holds whatever you put in the Left, same as always. The question is whether the *calling code* is coupling the wrong things together.

The answer turns on where you are. In the functional core — `transforms.js`, `digest.js` — errors should carry semantic meaning: `'Title was null'`, `'Items array is empty'`. That code has no business knowing it's serving HTTP.

But `handleFeedRequest` *is* HTTP code. It's in the shell by design. Putting `{ status: 400 }` in the Left there isn't a leak — it's the right layer making the right decision. The shell is exactly where HTTP error codes belong.

For a larger application you'd want semantic error types throughout the core and a single translation layer at the boundary. For this project, the pragmatic choice is the correct one: decide the shape at the HTTP entry point, normalise everything else to match via `mapError`.

## `Either.of` vs `Either.fromNullable`

The `/feeds` handler reveals a subtle choice. `searchParams.getAll('url')` always returns an array — never null, never undefined. `Either.fromNullable` checks for null/undefined, which will never trigger here. The validation we need is different: *is the array non-empty?*

```js
Either.of(urls)
  .filter(urls => urls.length > 0, { status: 400, message: 'Missing url parameter' })
  .fold(Task.rejected, Task.of)
  // ...
```

`Either.of` wraps the value in a Right without checking anything — because we already know the array exists. `filter` then applies the real condition. If the array is empty, it switches the Right to a Left with the error shape. If it has elements, it passes through unchanged.

This is `fromNullable` and `filter` used for what each is actually for: `fromNullable` for values that might be absent; `filter` for values that exist but might not meet a condition. Using the right tool makes the intent readable: "I have an array; require it to have at least one element."

## The Result

Three handlers, all following the same pattern:

```js
// /feed
Either.fromNullable(url, { status: 400, message: 'Missing url parameter' })
  .fold(Task.rejected, Task.of)
  .chain(url => processFeed(url, { category, search }))
  .mapError(err => ({ status: 500, message: `Error processing feed: ${err.message}` }))
  .fork(
    ({ status, message }) => sendError(res, status, message),
    items => sendJSON(res, 200, items)
  );

// /feeds
Either.of(urls)
  .filter(urls => urls.length > 0, { status: 400, message: 'Missing url parameter' })
  .fold(Task.rejected, Task.of)
  .chain(urls => processFeeds(...urls.map(url => url.trim())))
  .mapError(err => ({ status: 500, message: `Error processing feeds: ${err.message}` }))
  .fork(
    ({ status, message }) => sendError(res, status, message),
    items => sendJSON(res, 200, items)
  );

// /digest
Either.fromNullable(url, { status: 400, message: 'Missing url parameter' })
  .fold(Task.rejected, Task.of)
  .chain(processFeedForDigest)
  .mapError(err => ({ status: 500, message: `Error processing feed for digest: ${err.message}` }))
  .fork(
    ({ status, message }) => sendError(res, status, message),
    digest => sendJSON(res, 200, digest)
  );
```

The `fork` error handlers are now identical across all three routes. That's not a coincidence — it's what consistent error shapes give you. The shell can be read as a uniform pattern: validate, bridge to Task, process, normalise errors, respond.

## On Testing the Shell

You might notice there's no `server.test.js`. That's deliberate, not an oversight.

`server.js` contains no logic — only wiring. Every decision it delegates to is already tested: the algebraic types have their own test suites, the pure transforms have tests, `processFeed` and its siblings are covered indirectly through those. The shell's correctness follows from the correctness of the things it connects.

Testing the shell properly would mean either mocking `req` and `res` objects (which become harder to trust than the code they're testing) or running integration tests against a real HTTP server. Integration tests are valuable, but they're a topic of their own — and for a project this focused on the functional core, they'd add more ceremony than signal.

## A Few Things to Sit With

Before chapter seventeen:

- `mapError` transforms a single error on its way through a pipeline. But what about validation that produces *multiple* errors at once? `normalizeItem` stops at the first missing field — title null, done. What if you wanted to collect all validation failures: title null, link null, pubDate missing, all reported together?
- Either short-circuits: the first Left wins, and subsequent operations are skipped. That's useful when you want fail-fast behaviour. But for form validation — or for validating every field of a feed item — you want to know everything that's wrong, not just the first thing. Is there a type that accumulates errors instead of short-circuiting on the first one?
- If two errors can both be Lefts, how would you combine them? What operation would that require, and how does it differ from `chain`?

Chapter seventeen introduces the Validation type — an Either variant that collects failures rather than stopping at the first one, and the Applicative pattern that makes combining independent results possible.
