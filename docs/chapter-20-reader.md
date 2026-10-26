# Functions All the Way Down: Chapter 20
## Reader — Dependencies as an Argument

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

Chapter nineteen ended with three questions, and they were all the same question wearing different coats. What would it mean to describe the whole environment *once*, as a single value, and pass it to the parts of the app that need it? What would have to change about how a handler gets its store, before the handler could be tested against a throwaway one? And the giveaway: Task is a function in disguise, IO is a function in disguise — so what type is *a computation that needs an environment before it can produce a value* a disguise for?

A function. Of course it is. `env => a` — one argument in, one value out. This chapter builds the wrapper that makes that function a citizen of the series, then rewires the whole application around it.

First, though, look at what we're fixing. Configuration in the current server is a scatter: `getPort` reads `API_PORT` in one corner of `server.js`, the store reads `FEEDS_DB` in another, and the logger has no level at all because there is nowhere for one to live. Worse, the handlers close over a `store` the module created above them, so their most important dependency is invisible in their signatures. Invisible dependencies are just globals with better PR. You cannot tell what `handleSaveFeedRequest` needs by looking at it — and what you cannot see, you cannot substitute in a test.

## Building Reader

Here is the whole type. It should look familiar; it is Maybe's shape with the container swapped for a function.

```js
// src/lib/reader.js
export const Reader = run => ({
  runReader: env => run(env),

  map: fn => Reader(env => fn(run(env))),

  chain: fn => Reader(env => fn(run(env)).runReader(env)),
});

Reader.of   = x  => Reader(() => x);
Reader.ask  = Reader(env => env);
Reader.asks = fn => Reader(fn);
```

`map` transforms the value the computation will eventually produce. `chain` runs the first computation against the environment, uses its result to choose the next computation, and runs *that* against the same environment — the env is threaded through every step, supplied by nobody yet. `ask` is the computation that produces the environment itself; `asks` projects one piece of it. And `runReader` is the escape hatch: hand the computation its environment and get a plain value back.

Notice what building a Reader does not do: run anything. Like Task before `fork` and IO before `run`, a Reader is a description. Which means `runReader` joins the family — `fold` unwraps an Either, `fork` runs a Task, `run` executes an IO, `runReader` supplies an environment. **Describe everywhere; execute at the boundary.** Four types in, that sentence has not needed editing yet.

## ReaderTask: You Already Know Both Halves of This

A Reader produces a value synchronously. Our handlers produce values asynchronously, by fetching and saving. What the handlers actually are, written honestly, is `env => Task` — the composition of the two types we already own. So we build that composition and give it the name it has in the wider world: **ReaderTask**.

```js
// src/lib/reader.js
export const ReaderTask = run => ({
  runReader: env => run(env),

  map: fn => ReaderTask(env => run(env).map(fn)),

  chain: fn => ReaderTask(env => run(env).chain(x => fn(x).runReader(env))),

  mapError: fn => ReaderTask(env => run(env).mapError(fn)),
});
```

There is no new idea in this code. `map` delegates to Task's `map`; `chain` runs the first ReaderTask against the env, then runs whichever ReaderTask comes next against the *same* env; `mapError` is Task's, passed through. If Reader and Task each took a chapter to understand, their composition takes a paragraph — and that is not a disappointment, it's the payoff of building every type to the same shape.

## Configuration, Once, at Startup

With somewhere for configuration to *live*, it can finally be treated properly: parsed once, as a whole, before anything starts. And parsing the process environment is a job we have already solved, in chapter seventeen — the environment is untrusted input with several independently fallible fields, so it gets Validation and a curried constructor, accumulating every problem at once.

```js
// src/config.js
const validatePort = raw => {
  if (raw === undefined) return Success(3000);
  const port = Number(raw);
  return (Number.isInteger(port) && port >= 1 && port <= 65535)
    ? Success(port)
    : Failure([`PORT must be an integer between 1 and 65535 (got "${raw}")`]);
};

export const parseConfig = (env = process.env) =>
  Validation.of(port => feedsDb => logLevel => ({ port, feedsDb, logLevel }))
    .ap(validatePort(env.PORT))
    .ap(validateFeedsDb(env.FEEDS_DB))
    .ap(validateLogLevel(env.LOG_LEVEL));
```

Start the server with `PORT=abc LOG_LEVEL=loud` and this is the entire conversation it has with you:

```
Invalid configuration — the server will not start:
  PORT must be an integer between 1 and 65535 (got "abc")
  LOG_LEVEL must be one of debug, info, warn, error (got "loud")
```

Both failures, reported together, and then the process exits — no store opened, no port bound, nothing half-started to clean up. Fail fast, with *all* the failures. Chapter seventeen built this pattern for feed items; it turns out to work at the scale of the whole application, because it was never really about feed items.

## The Environment Is Capabilities

On success, `main()` assembles the environment: the parsed config, a store created from `config.feedsDb`, a logger created from `config.logLevel`. Three fields. That smallness is a rule, and it's worth stating as one: **the environment holds capabilities, never data.** A store is a capability. A logger is a capability. The request body is data, and it travels through the pipeline as data, exactly as before — the moment request data moves into the env, the env stops being the app's fixed world and becomes a junk drawer with a type.

The handlers change less than you might expect. Here is chapter nineteen's save handler, rewired:

```js
// src/server.js
export const handleSaveFeedRequest = req => ReaderTask(env =>
  readBody(req)
    .chain(body => {
      const result = validateFeedInput(body);
      return (result.valid
        ? Either.of(result.data)
        : Left({ status: 400, message: result.errors.join('; ') }))
        .fold(Task.rejected, Task.of);
    })
    .chain(feed => env.store.saveFeed(feed))
    .mapError(err => err && typeof err.status === 'number' ? err : ({ status: 500, message: `Error saving feed: ${err.message ?? err}` }))
    .map(feed => ({ status: 201, body: feed }))
);
```

The pipeline is untouched — same validation, same bridge, same `mapError` discipline. Two things moved: the store is `env.store`, arrived as an argument instead of captured from module scope; and the handler no longer writes to `res`. It resolves to a *description* of the response, `{ status, body }`, and the dispatch code in `main()` — the boundary — performs the one `runReader` and the one `fork` that turn descriptions into HTTP. Every route in the server behaves exactly as it did in chapter nineteen; only the wiring changed. That's rather the point.

## Swap the Env, Not the Code

And now the test that was impossible two chapters ago. The handler is a value. A test can hold it, supply an environment of the test's own making — an in-memory store with the same interface, a logger that prints nothing — and fork the result:

```js
// src/handlers.test.js
const store = makeFakeStore();
const result = await runTask(
  handleSaveFeedRequest(fakeReq({ url: 'https://example.com/rss.xml', title: 'Example' }))
    .runReader(fakeEnv(store))
);
assert.equal(result.status, 201);
```

No database. No HTTP. No mocking framework, because there is nothing to mock — there is only an argument to supply. The duplicate test is the same test with a store that already holds the URL; the invalid-body test never reaches the store at all. **A handler's dependencies, stated in one argument, are a handler you can test.** This is also the ground chapter twenty-one's integration tests will stand on.

## The Honest Limitation

Reader has a failure mode, and it is not subtle: the environment can grow. A fourth capability seems harmless, then a seventh, then somebody tucks a cache, a clock and a feature-flag client in there "temporarily" — and now every handler silently depends on everything, which is the invisible-dependency problem all over again, with a type signature on it.

The defence is the discipline, not the type: the env stays a small, named set of capabilities, each one earning its place. If a function needs the whole world, that is information about the function, not an invitation to enlarge the world.

## A Few Things to Sit With

Before chapter twenty-one:

- A feed URL that never responds leaves a Task pending forever. Nothing in the server notices, nothing cancels it, and the request just… hangs. What would a timeout even *be*, in a system built from lazy descriptions — and who owns it, the Task or the shell?
- Restarting the server in chapter nineteen, we checked the feeds survived. We did not check what happened to the requests that were in flight at the moment of the kill. What *should* happen to them when the process is told to stop?
- The store has a `close()` that nothing has ever called. Whose job is it to call it — and when?

Chapter twenty-one takes the app into production: timeouts and cancellation for the Tasks that hang, a graceful answer to being told to stop, and the integration tests that run the whole server end to end. Everything is now wired, saved and testable — what remains is everything that can go wrong at 3 a.m.
