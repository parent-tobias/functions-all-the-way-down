# Functions All the Way Down: Chapter 18
## Taming Sync Side Effects — The IO Type

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

Chapter 7 introduced Task as a way to make async side effects composable: wrap the effect in a lazy computation, describe the pipeline, trigger it only at the boundary. That principle — *postpone the decision* — applies equally to synchronous side effects. Not every impure operation involves a network call.

## The Problem With Sync Side Effects

Consider these lines from `server.js`:

```js
const PORT = 3000;

server.listen(PORT, () => {
  console.log(`Feed aggregator running at http://localhost:${PORT}`);
});
```

`console.log` writes to stdout the moment it's called — a side effect with no return value worth testing, no way to compose it with anything else, no way to defer it. It just *runs*.

Reading from the environment has the same problem:

```js
const PORT = process.env.API_PORT || 3000;
```

This reads from `process.env` immediately, at the moment the module loads. Call it again later and you might get a different answer. It's not referentially transparent — you can't replace it with its result and have the same program.

For the processing pipeline, none of this matters. `transforms.js` is pure; `fetch-feed.js` describes lazy Tasks. But `server.js` is the imperative shell — it's *supposed* to have side effects. The question is whether those effects can be named, composed, and deferred in the same way the async ones are.

## IO: A Lazy Wrapper for Sync Effects

The IO type wraps a synchronous side-effectful computation in a function, making the wrapper itself referentially transparent:

```js
export const IO = fn => ({
  map:   fn2 => IO(() => fn2(fn())),
  chain: fn2 => IO(() => fn2(fn()).run()),
  run:   () => fn(),
});

IO.of = value => IO(() => value);
```

`IO(() => process.env.API_PORT || 3000)` is a pure value. It describes the act of reading the port without doing it. Every reference to this value is the same value — no side effects have occurred yet. Only `.run()` is impure.

This is exactly the same principle as Task. The difference is that Task wraps async computations with a `(reject, resolve)` interface, while IO wraps sync computations with no interface at all — just `() => value`.

## `map` and `chain`

`map` transforms the result without breaking laziness:

```js
IO(() => process.env.API_PORT || 3000)
  .map(port => parseInt(port, 10))
  .map(port => port || 3000)
  // nothing has run yet — this is still an IO
```

`chain` is for when the next step is itself an IO. The same rule as everywhere else: `map` for plain functions, `chain` for functions that return a wrapped value.

```js
const double = x => IO.of(x * 2);  // returns an IO

IO.of(21)
  .chain(double)
  .run()  // 42
```

`chain` runs the inner IO to unwrap it, preventing the nested `IO(IO(...))` you'd get with `map`.

## The Logger Pattern

`console.log` is a side effect. Wrapping it in IO gives it a name and makes it composable:

```js
const logger = message => IO(() => console.log(message));
```

`logger` is a pure function: given the same message, it always returns the same IO value. The `console.log` hasn't run yet.

Two log messages can be sequenced with `chain`. When you don't need the return value of the previous IO — `console.log` returns `undefined` — you signal that with `() =>`:

```js
logger('Server starting...')
  .chain(() => logger('Ready.'))
  .run();
```

This is IO doing what Task does with asynchronous steps: describing a sequence of effects as a single composable value, then triggering the whole thing at once.

## Applying IO to Server Startup

The refactored `server.js` startup:

```js
const getPort = IO(() => process.env.API_PORT || 3000);
const logger  = message => IO(() => console.log(message));

// ... route handlers ...

const PORT = getPort.run();

server.listen(PORT, () => {
  logger(`Feed aggregator running at http://localhost:${PORT}`)
    .chain(() => logger(`Try: http://localhost:${PORT}/feed?url=https://feeds.npr.org/1001/rss.xml`))
    .run();
});
```

`getPort` is a named, composable description of where the port comes from. `logger` is a named, composable description of what logging looks like. Neither has done anything yet when they're defined.

`getPort.run()` is the single call that reads from the environment. It happens once, at the top of the server startup sequence, and the result is used throughout. The startup log messages are described as a chain of IO values and triggered with `.run()` inside the `server.listen` callback — the outermost boundary of the startup process.

## The Boundary, Again

Every type in this series has the same rule: effects happen at the boundary. Maybe exits through `.getOrElse()`. Either exits through `.fold()`. Task exits through `.fork()`. IO exits through `.run()`.

`server.js` is the boundary. It's the one file that is *allowed* to call `.run()`, `.fork()`, and to talk directly to `http.createServer`. Everything inside the functional core — `transforms.js`, `fetch-feed.js`, the algebraic types — never calls any of these. The impurity is contained, named, and placed exactly where it belongs.

IO makes that containment explicit for sync effects. Before, `const PORT = 3000` was just a constant. After, `const getPort = IO(...)` followed by `getPort.run()` is a deliberate statement: *here is where we read from the environment, and here is where we decide to do it*.

## IO vs Task

| | IO | Task |
|---|---|---|
| What it wraps | Synchronous side effects | Asynchronous side effects |
| Escape hatch | `.run()` | `.fork(reject, resolve)` |
| Error handling | None (sync throws propagate normally) | Explicit reject path |
| Composition | `map`, `chain` | `map`, `chain`, `mapError`, `Task.all` |

IO doesn't have an error channel. If the wrapped function throws, the exception propagates normally — you're still in synchronous code. For the kind of effects IO is used for (reading environment variables, logging), that's appropriate. A missing `PORT` is a configuration error; letting it throw and crash the process is reasonable.

## A Few Things to Sit With

Before the final chapter:

- `getPort.run()` is called at module-level in `server.js` — which means it runs when the file is first imported. Is that meaningfully different from `const PORT = process.env.API_PORT || 3000`? What does IO add here beyond naming the intent?
- `logger` is a function that returns an IO. That's the same shape as a Task factory — `processFeed` is a function that returns a Task. What does it mean that these patterns look identical at the boundary between named intent and execution?
- Every algebraic type in this series has been built from the same raw material: a closure over a function or value, with a consistent interface of `map`, `chain`, and an escape hatch. What does that suggest about what these types actually *are*?
