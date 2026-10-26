# Functions All the Way Down: Chapter 21
## Production — Running It for Real

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

Chapter twenty ended with a feed that hangs forever, a kill signal nobody had rehearsed, and a `close()` that nothing had ever called. Behind those questions sits an older debt: back in chapter eight, this series wrote down Task's honest limitations — no timeout, no cancellation, no settle-once guard, an empty `Task.all` that never settles — and promised, implicitly, to understand them rather than fix them. Production is where admitted limitations come to collect. This chapter pays all of it.

## First, Settle Once

A Task whose executor calls `resolve` and then, carelessly or maliciously, calls `reject` as well is a small betrayal: the consumer hears two outcomes for one computation. `Task.all` made it worse — two failing feeds could fire the outer reject twice, which in a server means writing the error response twice.

The fix belongs in exactly one place. Not in `Task.all`, not in every handler — in `fork` itself, so that every Task ever built inherits it:

```js
// src/lib/task.js
const fork = (reject, resolve) => {
  let settled = false;
  const guardedReject = err => {
    if (!settled) { settled = true; reject(err); }
  };
  const guardedResolve = value => {
    if (!settled) { settled = true; resolve(value); }
  };
  run(guardedReject, guardedResolve);
};
```

Whichever handler is called first wins; everything after that is ignored. And with the guard underneath it, `Task.all` gets its second fix almost for free — several failures still settle the race exactly once — plus its third, an explicit one: an empty list now resolves immediately with `[]`, because there is nothing to wait for. Chapter eight's list is getting shorter.

## A Deadline Is a Race

What would a timeout *be*, for a lazy description? The same thing it is everywhere else in this series: another Task, raced against the first. `timeout` runs the original Task and a timer together; whichever settles first settles the result, and the guard above throws the latecomer away:

```js
// src/lib/task.js
timeout: ms => Task((reject, resolve) => {
  const timer = setTimeout(() => reject(timeoutError(ms)), ms);
  if (timer.unref) timer.unref();
  fork(
    err   => { clearTimeout(timer); reject(err); },
    value => { clearTimeout(timer); resolve(value); }
  );
}),

export const timeoutError = ms => ({
  status:  504,
  code:    'FEED_TIMEOUT',
  message: `Timed out after ${ms} ms`,
});
```

Notice the shape of the timeout error: `{ status, message }`, decided where the deadline is set, with a `code` so the shell's error normalisation can recognise it and pass it through untouched — chapter sixteen's discipline, one more time. A timeout becomes an HTTP 504, which is simply the truth: the gateway waited, and the feed didn't answer.

Be honest about what this is not. It is not cancellation in the strong sense. The fetch already sent still completes; the socket does its work unwatched. What `timeout` gives you is **cancellation as stop-listening** — the application stops caring, promptly and safely, even though the effect itself runs out its clock in the dark. Libraries like Fluture implement true cancellation, where the underlying work is actually interrupted; when you need that, you will know, and chapter eight already pointed at the door. For a feed aggregator, stop-listening plus a deadline is the honest 95%.

## Retry: A Pure Policy, an Impure Wait

A feed that fails once often answers the second time. Retrying is a policy — *how many more attempts, waiting how long between them* — and policies in this codebase are pure functions that produce data:

```js
// src/lib/task.js
export const delays = (attempts, baseMs) =>
  Array.from({ length: attempts }, (_, i) => baseMs * 2 ** i);
```

`delays(3, 100)` is `[100, 200, 400]`. That is the whole backoff strategy, assertable in a test without waiting for anything. `Task`'s `retry` consumes the schedule: on rejection, wait the next delay — the wait itself a small Task built on a timer, the impure part kept at the edge — and fork the original description again. Fresh fork, fresh attempt, because a Task is a description and descriptions can be run twice.

The server wires both halves around the one thing that can hang or flap — the network:

```js
// src/server.js
const withResilience = (task, config) =>
  task
    .timeout(config.feedTimeoutMs)
    .retry(config.feedRetries, RETRY_BASE_DELAY_MS);
```

The numbers live in the config now — `FEED_TIMEOUT_MS` (default 10000) and `FEED_RETRIES` (default 2, at most 5), validated at startup with everything else, which means a typo fails the boot with its name in the message instead of surprising you in production. And the arithmetic is checkable: point the finished server at a feed that never responds with a 300 ms deadline, and the 504 arrives after three attempts and two waits — about 1.7 seconds, exactly as the schedule predicts.

## Being Able to Ask: /health and the Log

Production also means the app can be *asked* how it is — by a load balancer, an uptime checker, or you at 3 a.m. The health check is a handler like any other, a ReaderTask that asks the store a small, real question:

```js
// src/server.js
export const handleHealthRequest = () => ReaderTask(env =>
  env.store.ping()
    .map(count => ({ status: 200, body: { status: 'ok', feeds: count } }))
    .mapError(err => ({ status: 503, message: `Store unavailable: ${err.message ?? err}` }))
);
```

`ping()` runs an actual `COUNT` query. That choice is the whole philosophy in miniature: a health check that always answers "fine" is a lie with an endpoint. If the store can count its feeds, the app is up; if it can't, the honest answer is a 503 with the reason attached.

Every request also leaves one line in the log — method, path, status, duration — written as data through the environment's logger capability, never a stray `console.log`:

```
GET /health 200 5ms
POST /feeds 201 5ms
GET /feed 504 2007ms
```

That third line is the timeout and the log finding each other. You can see the deadline hold.

## Leaving Cleanly

And the `close()` that nothing called. Startup has a counterpart, and it is boundary work of exactly the same kind: on `SIGTERM` or `SIGINT`, the server stops accepting new connections, lets the requests in flight finish — up to a five-second drain cap, because one stuck request must not hold the process hostage — then closes the store and exits 0. Rehearsed against the hanging feed, the log tells the story in order:

```
SIGTERM received — draining 1 in-flight request(s)
GET /feed 504 2007ms
All requests drained
Store closed — shutdown complete
```

The in-flight request was not cut off mid-sentence; it met its own deadline, answered 504, and *then* the process left. A lifecycle is boundary work from the first byte to the last — assembly at startup, drain and close at shutdown, and the pure core aware of none of it.

## The Tests That Were Promised

Three times, this series deferred testing the shell: chapter twelve raised it, chapter thirteen said the shell would be "better tested with integration tests", chapter sixteen called them a topic of their own. Here they are. `src/server.integration.test.js` boots the *real* server as a child process — ephemeral port, temporary database, a local fake feed server serving a small valid RSS document and one route that never answers — and asserts over real HTTP: the feed comes back normalised; saving a feed and reading it back works; the health check counts it; the hanging route meets its 504.

And it includes, as a worked example, the regression that proves why this suite had to exist: `GET /feed` with no URL must be the shaped 400, `Missing url parameter` — the very assertion that would have caught chapter sixteen's bug before it shipped. The untested shell hid that bug for three chapters. It hides nothing now: the suite stands at 137 tests, all passing.

## The Honest Limitation

What this server still doesn't have: metrics, tracing, an APM vendor's SDK glowing in the corner. No counters of requests per route, no spans following a fetch across the boundary. That absence is a choice, but it is not a purity problem waiting for a cleverer pattern — an observability SDK is shell equipment, like the HTTP server and the database driver, and it would live exactly where they live: in `main()` and the store, initialised at startup, threaded through the environment as one more capability if the handlers ever needed to speak to it. The core would stay silent, which is not the same as the app being blind. Reach for it when the 3 a.m. questions outgrow the log lines; the architecture has a place ready for it.

## A Few Things to Sit With

Before the final chapter:

- Everything in this part of the series — the store, the environment, the deadlines, the shutdown — was added around a functional core that did not change to accommodate any of it. Go back and look: `transforms.js`, `maybe.js`, `either.js` are the files you wrote in the first half of the series. What, precisely, did the core have to *not* know, for that to be possible?
- The application is now one complete thing: it remembers, it's configured, it survives bad networks and polite kill signals. But it has exactly one shape — an HTTP server. What would a *different* shape — a command-line tool that prints a digest, a background worker that polls feeds overnight — reuse unchanged, and what would it have to rebuild?
- And the smaller, sharper version of the same question: which files in this project would you carry into your next project verbatim, without editing a line?

Chapter twenty-two steps back and takes stock of the whole series: what you have actually built, what it was secretly an introduction to, and where the road goes from here — beginning with that second shape.
