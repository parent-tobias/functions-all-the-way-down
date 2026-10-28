# Chapter 21: Production — Running It for Real — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

Ch20 ended with a feed that hangs forever, a kill signal nobody rehearsed, and a close() nothing ever called — plus an older debt from Ch8, where Task's limitations were written down honestly (no timeout, no cancellation, no settle-once guard, empty Task.all never settles) with an implicit promise to understand rather than fix → production is where admitted limitations come to collect; this chapter pays all of it.

## First, Settle Once

A Task whose executor calls resolve then carelessly or maliciously calls reject = a small betrayal, the consumer hears two outcomes for one computation; Task.all made it worse → two failing feeds could fire the outer reject twice, which in a server means writing the error response twice.

The fix belongs in exactly one place — not in Task.all, not in every handler, but in fork itself, so every Task ever built inherits it:

> [Code: fork rewritten with a settled flag and guarded reject/resolve wrappers]

First call wins, everything after is ignored; with the guard underneath, Task.all gets its second fix almost free (several failures still settle the race exactly once) plus a third, explicit one: an empty list now resolves immediately with [] because there's nothing to wait for → Ch8's list is getting shorter.

## A Deadline Is a Race

A timeout for a lazy description = the same as everywhere else in this series: another Task, raced against the first → timeout runs the original Task and a timer together, whichever settles first settles the result, and the settle-once guard throws the latecomer away.

> [Code: Task timeout — timer raced against the fork, loser ignored — plus the timeoutError shape]

The timeout error's shape matters: { status, message } decided where the deadline is set, plus a code so the shell's error normalisation recognises it and passes it through untouched (Ch16's discipline, one more time) → a timeout becomes an HTTP 504, which is simply the truth: the gateway waited and the feed didn't answer.

Honesty about what this is not: not cancellation in the strong sense — the fetch already sent still completes, the socket works unwatched → timeout gives cancellation as stop-listening, the app stops caring promptly and safely while the effect runs out its clock in the dark; libraries like Fluture do true cancellation (chapter eight already pointed at that door), and for a feed aggregator stop-listening plus a deadline is the honest 95%.

## Retry: A Pure Policy, an Impure Wait

A feed that fails once often answers the second time; retrying is a policy (how many more attempts, waiting how long between) → and policies here are pure functions that produce data:

> [Code: delays — a pure function turning attempts + base delay into an exponential backoff schedule]

delays(3, 100) = [100, 200, 400] — the whole backoff strategy, assertable in a test without waiting for anything; Task's retry consumes the schedule: on rejection, wait the next delay (the wait itself a small timer Task, the impure part kept at the edge) and fork the original description again → fresh fork, fresh attempt, because a Task is a description and descriptions can be run twice.

The server wires both halves around the one thing that can hang or flap — the network:

> [Code: withResilience — timeout + retry composed around a task, numbers taken from config]

The numbers live in config now — FEED_TIMEOUT_MS (default 10000) and FEED_RETRIES (default 2, at most 5), validated at startup with everything else → a typo fails the boot with its name in the message instead of surprising you in production; and the arithmetic is checkable: point the finished server at a never-responding feed with a 300 ms deadline and the 504 arrives after three attempts and two waits, about 1.7 seconds, exactly as the schedule predicts.

## Being Able to Ask: /health and the Log

Production also means the app can be asked how it is — by a load balancer, an uptime checker, or you at 3 a.m.; the health check is a handler like any other, a ReaderTask that asks the store a small, real question:

> [Code: handleHealthRequest — ReaderTask that pings the store and maps the count to a 200, or a 503 on error]

ping() runs an actual COUNT query — that choice is the whole philosophy in miniature: a health check that always answers "fine" is a lie with an endpoint → if the store can count its feeds the app is up; if it can't, the honest answer is a 503 with the reason attached.

Every request also leaves one line in the log — method, path, status, duration — written as data through the environment's logger capability, never a stray console.log:

> [Code: sample request log lines — health 200, feed save 201, timed-out fetch 504 with its long duration]

That third line is the timeout and the log finding each other → you can see the deadline hold.

## Leaving Cleanly

And the close() that nothing called: startup has a counterpart and it's boundary work of the same kind — on SIGTERM or SIGINT the server stops accepting new connections, lets in-flight requests finish up to a five-second drain cap (one stuck request must not hold the process hostage), then closes the store and exits 0; rehearsed against the hanging feed, the log tells the story in order:

> [Code: sample shutdown log — SIGTERM received, in-flight request drains to its 504, store closed, shutdown complete]

The in-flight request wasn't cut off mid-sentence — it met its own deadline, answered 504, and then the process left → a lifecycle is boundary work from the first byte to the last: assembly at startup, drain and close at shutdown, the pure core aware of none of it.

## The Tests That Were Promised

Three times the series deferred testing the shell (Ch12 raised it, Ch13 said the shell would be "better tested with integration tests", Ch16 called them a topic of their own) — here they are: server.integration.test.js boots the real server as a child process (ephemeral port, temporary database, a local fake feed server serving a small valid RSS document plus one route that never answers) and asserts over real HTTP → feed comes back normalised; saving a feed and reading it back works; the health check counts it; the hanging route meets its 504.

It includes, as a worked example, the regression that proves why this suite had to exist: GET /feed with no URL must be the shaped 400, "Missing url parameter" — the very assertion that would have caught Ch16's bug before it shipped → the untested shell hid that bug for three chapters; it hides nothing now, the suite stands at 137 tests, all passing.

## The Honest Limitation

What the server still doesn't have: metrics, tracing, an APM vendor's SDK glowing in the corner — no per-route counters, no spans following a fetch across the boundary; that absence is a choice, not a purity problem waiting for a cleverer pattern → an observability SDK is shell equipment, like the HTTP server and the database driver, and would live where they live (in main() and the store, initialised at startup, threaded through the env as one more capability if handlers ever needed it); the core would stay silent, which is not the same as the app being blind → reach for it when the 3 a.m. questions outgrow the log lines; the architecture has a place ready for it.

## A Few Things to Sit With

Before the final chapter:

- Questions to carry into the close: everything in this part of the series (store, env, deadlines, shutdown) was added around a functional core that didn't change to accommodate any of it — transforms.js, maybe.js, either.js are still the first-half files → what, precisely, did the core have to not know for that to be possible?; the app is now one complete thing (remembers, configured, survives bad networks and polite kill signals) but has exactly one shape, an HTTP server → what would a different shape (a CLI digest tool, a background worker polling feeds overnight) reuse unchanged, and what would it rebuild?; the smaller, sharper version: which files in this project would you carry into your next project verbatim, without editing a line?

Ch22 steps back and takes stock of the whole series: what you have actually built, what it was secretly an introduction to, and where the road goes from here — beginning with that second shape.
