# Chapter 7: Task — Lazy Async Computation — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

- Everything so far is synchronous: value in → value out, computation happens inline (pure fns, Maybe, Either).
- Fetching an RSS feed is different: request sent, data arrives at unknown future point, failure must be handled; JS answer = Promise, but Promises have a property that fights functional pipelines.
- Promises are eager.

## The Problem with Eagerness

- fetch(url) fires immediately → can't hold "the act of fetching" as a value without it already in flight; can't pass/configure/store it un-started.
- Composition consequence: pipeline of fetch → parse → normalize can't be wired up before triggering any of it with Promises — calling fetch starts it.
- Task = the alternative: represents future computation without executing it; nothing happens until .fork(); until then just a description of work.

## Building Task from Scratch

- Task built around a single function: the computation it will eventually run.

> [Code: task.js — Task constructor with fork/map/chain/fold, plus Task.of and Task.rejected]

- Task takes the computation fn → object with map/chain/fold/fork; computation takes reject + resolve callbacks (mirrors Promise constructor) but nothing runs until fork.
- Convention note: reject comes first, before resolve → error handling first-class, not an afterthought.

## `map` and `chain` on Tasks

- Methods look different from Maybe/Either; semantics identical.
- map: when task resolves → apply fn to result, resolve with new value.

> [Code: Task.of(5).map(x => x * 2).fork(...) → logs Value: 10]

- chain: when task resolves → call fn with result (fn returns another Task), fork that task; this is how async ops get sequenced.

> [Code: fetchText and parseJSON as Tasks, sequenced via fetchText(...).chain(parseJSON).fork(...)]

- chain sequences async ops without nested callbacks or .then() chains; each Task is a description, chain wires descriptions into a bigger one; nothing runs until fork.

## Building `processFeed`

- In the project: wrap fetch and rss-parser in Tasks, then compose.

> [Code: fetch-feed.js — fetchFeed wrapping fetch with ok-check and status error; parseFeed wrapping parser.parseString]

- fetchFeed wraps the network call, parseFeed wraps the parser; same shape both times: wrap existing async API in Task, success → resolve, error → reject.
- Then processFeed chains them with pure transforms in the middle:

> [Code: processFeed — fetchFeed → chain(parseFeed) → map items → normalize → filter valid → unwrap data → sortByDateDesc]

- Whole function returns a Task; calling processFeed(url) runs nothing — result is a description: "fetch, parse, normalize, keep valid, sort."
- Execution happens only at .fork() on the result — which lives in server.js.

## `fork` as the Escape Hatch

- fork = Task's exit, equivalent of Either's fold / Maybe's getOrElse; the one place you leave the functional world and hand control outside.

> [Code: processFeed(npr url).fork(err handler, items handler) — plain values out, no wrapper]

- Both fork handlers receive plain values — no Task, no wrapper; the Task is done.
- Architectural principle firms up: fork belongs only in the shell; core (transforms, Maybe/Either logic, processFeed) never forks — it builds/transforms Tasks; shell (server.js) forks and turns results into HTTP responses.

## Laziness as a Feature

- Practical payoff beyond composability: processFeed(url) can be passed around as a value before triggering; collect Tasks, configure differently, decide when/how to run.
- Sets up next chapter: ten processFeed Tasks for different URLs can sit idle, then all trigger at once — with Promises those ten fetches would already be in flight.

## A Few Things to Sit With

- Before chapter eight:
- Open questions to sit with: aggregating five feeds — sequential processFeed calls work but are slow, how to run concurrently and collect all results?; Promise.all equivalent for Tasks — parallel run, results in order, single Task of array?; if one of five feeds fails — fail-fast (whole thing fails) or continue and collect partial results?
- Next: chapter eight builds Task.all from scratch, wires it into a /feeds endpoint taking multiple URLs, discusses fail-fast behaviour in practice.
