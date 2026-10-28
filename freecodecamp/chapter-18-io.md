# Chapter 18: Taming Sync Side Effects — The IO Type — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

Note: series line — part of "Functions All the Way Down: Building an API using Functional Programming".

Note: Ch. 7 introduced Task → async side effects made composable by wrapping the effect in a lazy computation, describing the pipeline, triggering only at the boundary; that principle (*postpone the decision*) applies equally to synchronous side effects → not every impure operation is a network call.

## The Problem With Sync Side Effects

Note: consider these lines from `server.js` →

> [Code: server startup — hardcoded PORT and server.listen logging via console.log]

Note: `console.log` writes to stdout the moment it's called → a side effect with no testable return value, no composing with anything, no deferring; it just *runs*.

Note: reading from the environment has the same problem →

> [Code: reading PORT from process.env at module load]

Note: `process.env` read happens immediately, at module load → call it again later, maybe a different answer; not referentially transparent, can't swap the expression for its result and keep the same program.

Note: none of this matters for the processing pipeline (transforms.js pure, fetch-feed.js describes lazy Tasks) → but server.js is the imperative shell, *supposed* to have side effects; open question = can those effects be named, composed, and deferred like the async ones?

## IO: A Lazy Wrapper for Sync Effects

Note: IO wraps a synchronous side-effectful computation in a function → the wrapper itself is referentially transparent →

> [Code: the IO definition — map, chain, run — plus IO.of]

Note: `IO(() => process.env.API_PORT || 3000)` is a pure value → describes reading the port without doing it; every reference to it is the same value, no effects yet; only `.run()` is impure.

Note: same principle as Task → difference = Task wraps async computations behind a `(reject, resolve)` interface, IO wraps sync ones with no interface at all, just `() => value`.

## `map` and `chain`

Note: `map` transforms the result without breaking laziness →

> [Code: IO reading the env port, mapped through parseInt and a fallback — still unrun]

Note: `chain` is for when the next step is itself an IO → same rule as everywhere: map for plain functions, chain for functions returning a wrapped value →

> [Code: chain with an IO-returning double function, .run() yielding 42]

Note: `chain` runs the inner IO to unwrap it → prevents the nested `IO(IO(...))` that `map` would produce.

## The Logger Pattern

Note: `console.log` is a side effect → wrapping it in IO gives it a name and makes it composable →

> [Code: logger defined as message => IO wrapping console.log]

Note: `logger` is a pure function → same message in, same IO value out; the console.log hasn't run yet.

Note: two log messages sequenced with `chain` → when the previous IO's return value isn't needed (console.log returns `undefined`), signal that with `() =>` →

> [Code: two logger IOs chained and triggered with a single .run()]

Note: IO does for synchronous steps what Task does for asynchronous ones → describe a sequence of effects as one composable value, trigger the whole thing at once.

## Applying IO to Server Startup

Note: the refactored `server.js` startup →

> [Code: getPort and logger as IO values; getPort.run() at startup, logger chain run inside the listen callback]

Note: `getPort` = a named, composable description of where the port comes from; `logger` = a named, composable description of what logging looks like; neither has done anything at definition time.

Note: `getPort.run()` is the single environment read → happens once, at the top of the startup sequence, result used throughout; startup log messages described as a chain of IO values and triggered with `.run()` inside the `server.listen` callback → the outermost boundary of the startup process.

## The Boundary, Again

Note: every type in the series obeys the same rule → effects happen at the boundary; Maybe exits through `.getOrElse()`, Either through `.fold()`, Task through `.fork()`, IO through `.run()`.

Note: server.js *is* the boundary → the one file allowed to call `.run()`/`.fork()` and to talk to `http.createServer` directly; everything in the functional core (transforms.js, fetch-feed.js, the algebraic types) never calls any of these; impurity contained, named, placed exactly where it belongs.

Note: IO makes that containment explicit for sync effects → before: `const PORT = 3000`, just a constant; after: `const getPort = IO(...)` + `getPort.run()` = a deliberate statement — here is where we read from the environment, and here is where we decide to do it.

## IO vs Task

Note: comparison items → what it wraps (IO: synchronous side effects / Task: asynchronous side effects); escape hatch (IO: `.run()` / Task: `.fork(reject, resolve)`); error handling (IO: none, sync throws propagate normally / Task: explicit reject path); composition (IO: `map`, `chain` / Task: `map`, `chain`, `mapError`, `Task.all`).

Note: IO has no error channel → if the wrapped function throws, the exception propagates normally (still synchronous code); appropriate for the effects IO serves (env vars, logging) → a missing `PORT` is a configuration error, letting it throw and crash the process is reasonable.

## A Few Things to Sit With

Note: before we go on to make the application remember, take stock →

Note: questions to sit with → `getPort.run()` is called at module level in server.js, so it runs on first import — is that meaningfully different from `const PORT = process.env.API_PORT || 3000`, and what does IO add beyond naming the intent?; `logger` is a function returning an IO — same shape as a Task factory like `processFeed` returning a Task — what does it mean that these patterns look identical at the boundary between named intent and execution?; every algebraic type in the series is built from the same raw material (a closure over a function or value + consistent `map`/`chain`/escape-hatch interface) — what does that suggest about what these types actually *are*?
