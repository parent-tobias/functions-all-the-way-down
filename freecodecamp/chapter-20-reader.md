# Chapter 20: Reader — Dependencies as an Argument — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

Ch19 ended with three questions that are one question → describe the whole environment once, as a single value, and pass it to whatever needs it; what must change about how a handler gets its store so it can be tested against a throwaway one; Task and IO are functions in disguise → what type is "a computation that needs an environment first" a disguise for?

Answer: a function — `env => a`; this chapter builds the wrapper that makes that function a series citizen, then rewires the whole app around it.

The problem being fixed: config is scattered (port read in one corner of server.js, store reads its own env var elsewhere, logger has no level because there's nowhere for one to live) and handlers close over a module-created store → deps invisible in signatures; invisible deps = globals with better PR; can't see what a handler needs → can't substitute it in a test.

## Building Reader

The whole type — familiar shape: Maybe's structure with the container swapped for a function.

> [Code: the full Reader type — runReader, map, chain, of, ask, asks]

How the pieces work: map → transform the value the computation will eventually produce; chain → run first computation against env, use its result to pick the next, run that against the same env (env threaded through, supplied by nobody yet); ask → the computation that produces the env itself; asks → project one piece of it; runReader → the escape hatch, hand it the env and get a plain value back.

Building a Reader runs nothing — like Task before fork and IO before run, it's a description; runReader joins the unwrap family (fold / fork / run / runReader) → describe everywhere, execute at the boundary; four types in, that sentence still hasn't needed editing.

## ReaderTask: You Already Know Both Halves of This

Reader produces a value synchronously, handlers produce values asynchronously → handlers honestly are `env => Task`; build that composition and give it its wider-world name: ReaderTask.

> [Code: ReaderTask — Reader's shape with every operation delegating to Task's]

No new idea in it: map delegates to Task's map, chain runs first ReaderTask against env then the next against the same env, mapError is Task's passed through → if Reader and Task each took a chapter, their composition takes a paragraph, and that's the payoff of building every type to the same shape, not a disappointment.

## Configuration, Once, at Startup

With somewhere for config to live, treat it properly: parse once, as a whole, before anything starts — and parsing process env is the Ch17 problem again (untrusted input, several independently fallible fields) → Validation + curried constructor, accumulating every problem at once.

> [Code: parseConfig in config.js — Validation applicative over port / feedsDb / logLevel validators]

> [Code: sample startup output — both the bad PORT and bad LOG_LEVEL reported together, then exit]

Both failures reported together, then the process exits — no store opened, no port bound, nothing half-started to clean up → fail fast with all the failures; the Ch17 pattern works at whole-application scale because it was never really about feed items.

## The Environment Is Capabilities

On success main() assembles the env: parsed config + store built from config + logger built from config — three fields, and the smallness is a rule: the environment holds capabilities, never data (store = capability, logger = capability; request body = data and still travels through the pipeline as data) → the moment request data moves into env, env stops being the app's fixed world and becomes a junk drawer with a type.

The handlers change less than expected — Ch19's save handler, rewired:

> [Code: handleSaveFeedRequest as a ReaderTask — same pipeline, store now read from env]

Pipeline untouched (same validation, same bridge, same mapError discipline); two things moved: the store arrives as env.store, an argument instead of module scope; and the handler no longer writes to res — it resolves to a response description { status, body }, while dispatch in main() (the boundary) does the one runReader and one fork → every route behaves exactly as in Ch19, only the wiring changed, which is rather the point.

## Swap the Env, Not the Code

Now the test that was impossible two chapters ago: the handler is a value → hold it, supply an env of the test's own making (in-memory store with the same interface, a logger that prints nothing), fork the result.

> [Code: handler test — fake store + fake env, runReader, assert 201]

No database, no HTTP, no mocking framework — nothing to mock, only an argument to supply; the duplicate test = same test with a store already holding the URL, the invalid-body test never reaches the store → a handler's dependencies stated in one argument are a handler you can test; also the ground Ch21's integration tests stand on.

## The Honest Limitation

Reader's failure mode isn't subtle: the env can grow — a fourth capability, then a seventh, then a cache, a clock and a feature-flag client tucked in "temporarily" → every handler silently depends on everything, the invisible-dependency problem all over again, now with a type signature on it.

The defence is discipline, not the type: env stays a small, named set of capabilities, each earning its place → if a function needs the whole world, that's information about the function, not an invitation to enlarge the world.

## A Few Things to Sit With

Before chapter twenty-one:

- Open questions to carry forward: a feed URL that never responds leaves a Task pending forever and the request just hangs → what would a timeout even be in a system of lazy descriptions, and who owns it, the Task or the shell?; Ch19's restart check verified feeds survived but not the requests in flight at the kill → what should happen to them when the process is told to stop?; the store has a close() nothing has ever called → whose job is it to call it, and when?

Ch21 takes the app into production: timeouts and cancellation for hanging Tasks, a graceful answer to being told to stop, integration tests running the whole server end to end → everything is wired, saved and testable; what remains is everything that can go wrong at 3 a.m.
