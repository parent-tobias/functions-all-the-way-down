# Functions All the Way Down: Chapter 15
## Composing Types — The Either → Task Bridge

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

The pure core of the `/digest` feature is tested and working. `buildDigest` takes a raw feed and normalized items and returns a digest shape. The question left open at the end of chapter fourteen is how to wire that pure core into an HTTP endpoint.

Two things need to happen: validate the incoming request (does the URL parameter exist?), then fetch and process the feed asynchronously if it does. The first is synchronous and belongs in Either. The second is async and belongs in Task.

The problem is that they're different types, and you can't call `.chain()` across them directly. You need a bridge.

## The Async Layer

First, `processFeedForDigest`. It follows the same shape as `processFeed`, but with one difference: it can't discard the raw feed object after extracting `.items`.

`processFeed` does this:

```js
.chain(parseFeed)
.map(feed => feed.items)         // feed discarded here
.map(items => items.map(normalizeItem))
// ...
```

Once you've mapped to `feed.items`, the feed metadata — including the title — is gone. `buildDigest` needs both. The solution is a single `.map()` that keeps both in scope:

```js
export const processFeedForDigest = (url) =>
  fetchFeed(url)
    .chain(parseFeed)
    .map(rawFeed => {
      const items = rawFeed.items
        .map(normalizeItem)
        .filter(r => r.valid)
        .map(r => r.data);
      return buildDigest(rawFeed, sortByDateDesc(items));
    });
```

The local `items` variable gives `buildDigest` what it needs without losing the feed reference. The shape changed not because the style is different, but because the data dependency required it. Both `rawFeed` and `items` need to exist at the same moment, so they share a scope.

## The Naive Handler

The simplest way to write `handleDigestRequest` follows the pattern already in `server.js`:

```js
const handleDigestRequest = (req, res) => {
  const { searchParams } = new URL(req.url, `http://localhost:${PORT}`);
  const url = searchParams.get('url');

  if (!url) return sendError(res, 400, 'Missing url parameter');

  processFeedForDigest(url)
    .fork(
      err    => sendError(res, 500, err.message),
      digest => sendJSON(res, 200, digest)
    );
};
```

This works. The `if (!url)` guard catches the invalid case and returns early; the Task handles the valid case. But there's a break in the pattern. The guard is an imperative conditional that exits the function before the pipeline starts. The rest of the code is declarative. The two styles sit side by side.

For a project demonstrating functional composition, that break is worth fixing.

## `fold` as a Bridge

The insight is that `fold` converts an Either into whatever type its two branches return — including a Task.

`Either.fromNullable(url, 'Missing url parameter')` gives you either a `Right(url)` or a `Left('Missing url parameter')`. If you fold over that Either with two Task constructors:

```js
Either.fromNullable(url, 'Missing url parameter')
  .fold(Task.rejected, Task.of)
```

...you get either `Task.rejected('Missing url parameter')` or `Task.of(url)`. Both are Tasks. The Either is gone; you have a single Task that either carries the error or carries the validated URL.

From there, `.chain(processFeedForDigest)` sequences the async work, and `.fork()` runs the whole thing:

```js
Either.fromNullable(url, 'Missing url parameter')
  .fold(Task.rejected, Task.of)
  .chain(processFeedForDigest)
  .fork(
    err    => sendError(res, 500, err),
    digest => sendJSON(res, 200, digest)
  );
```

This is one expression. Validation, async processing, and response handling are all in a single chain. No early return, no conditional, no break between the synchronous and asynchronous layers.

## Reading the Bridge

The bridge is worth reading carefully because the parameter order looks asymmetric:

```js
Either.fromNullable(url, 'Missing url parameter')
//    ^ value first, error second

  .fold(Task.rejected, Task.of)
//      ^ error first, value second
```

`fromNullable` is the entry point. It's optimistic: the thing you want is the primary argument, the error is a fallback if the primary is absent.

`fold` is the exit. It forces you to handle both cases explicitly. The convention — error first, value second — follows mathematical tradition: `fold(onLeft, onRight)`. The mental model that helps: read it as `fold(onError, onSuccess)`.

They're doing different jobs, so they have different orientations. Once you internalise it as "entry is value-first, exit is error-first," the asymmetry stops feeling wrong.

## The Tradeoff

There is one honest cost to the bridge. The `if (!url)` guard sent a 400 for a missing parameter. The bridge collapses both error cases — validation failure and fetch failure — into the same `fork` error handler, which currently sends 500 for both.

A missing URL parameter is a client error. A failed network request is a server error. They have different HTTP semantics.

You could preserve the distinction by making the error objects carry a status code from the start:

```js
Either.fromNullable(url, { status: 400, message: 'Missing url parameter' })
  .fold(Task.rejected, Task.of)
  .chain(processFeedForDigest)
  .fork(
    ({ status = 500, message }) => sendError(res, status, message),
    digest => sendJSON(res, 200, digest)
  );
```

But this only works if `processFeedForDigest` also rejects with the same `{ status, message }` shape — otherwise async errors arrive as plain `Error` objects and the destructuring gives you `undefined`. You'd need to map every rejection in the Task pipeline to this shape before it reaches `fork`.

The cleanest way to do that would be a `mapError` method on Task, symmetric to how `map` transforms the resolved value. Task doesn't have one in this project. You could add it:

```js
mapError: fn => Task((reject, resolve) => {
  fork(err => reject(fn(err)), resolve);
}),
```

Then the chain becomes:

```js
processFeedForDigest(url)
  .mapError(err => ({ status: 500, message: err.message }))
```

Whether the added precision is worth the added complexity depends on the project. For this one, a 500 for a missing URL is a minor inaccuracy — the server responded correctly, it just labelled the error wrong. A production API would want the distinction. A learning project probably doesn't.

The point is that the tradeoff exists, and you can see it clearly precisely because the bridge made the error paths explicit. When both validation and async failure land in the same `fork` handler, the question "do I need to distinguish them?" becomes unavoidable.

## What the Pattern Gives You

The Either → Task bridge is not exotic. It's a consequence of the same idea that makes all these types composable: they're containers with consistent interfaces, and `fold` is always the exit.

For Maybe, `fold`-equivalent is `getOrElse` — extract the value or fall back to a default.
For Either, `fold` handles both paths and produces a plain value.
For Task, `fork` handles both paths and triggers the side effect.

The bridge is `fold` used not to produce a plain value, but to produce a *Task*. Both branches return Tasks, so you end up with a Task — and from there, the rest of the pipeline is ordinary Task composition.

The underlying principle: **`fold` produces whatever its functions return.** If those functions return strings, you get a string. If they return Tasks, you get a Task. The bridge isn't a special feature of Either or Task — it's what `fold` has always been.

## A Few Things to Sit With

The series is now complete as a functional reference application, but the design space it opened is worth sitting with:

- `mapError` was discussed but not implemented. It's a natural addition to Task. What would the full Task implementation look like with `mapError`, and what other patterns would it unlock?
- The error objects in this project carry either strings (`'Missing url parameter'`) or Error instances. A consistent shape — say, `{ status, message }` from the point of origin — would let the fork handler be fully generic. What would it take to enforce that shape throughout the pipeline?
- Every container in this series (`Maybe`, `Either`, `Task`) has `map`, `chain`, and an exit. That consistency isn't accidental — it's what makes the bridge pattern possible. The specification that formalises these laws is [Fantasy Land](https://github.com/fantasyland/fantasy-land). If you want to understand *why* the pattern holds across all containers, that's the source.
