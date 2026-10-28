# Chapter 8: Task.all — Concurrent Operations — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

- processFeed pipeline works for a single URL, but the aggregator's purpose = combining multiple feeds; sequential = works but unnecessarily slow — fetches are independent, no reason to wait.
- This chapter: build Task.all (concurrent execution for multiple Tasks) + extend HTTP server to accept multiple feed URLs in one request.

## What `Task.all` Should Do

- Spec: array of Tasks in → run all concurrently → single Task resolving with array of results in input order, or rejecting immediately if any fails.
- Same contract as Promise.all; difference = Task.all is lazy — nothing runs until fork on the result.

## Building It from Scratch

> [Code: task.js — Task.all implementation: results array, completed counter, fork each task with shared reject and index-preserving resolve]

- Walkthrough: Task.all takes array of Tasks → returns new Task; when forked, iterates input Tasks and forks each one.
- Failure path: outer Task's reject passed directly into each inner fork → any failure immediately bubbles up and rejects the whole; fail-fast needs no extra logic, it's a consequence of sharing reject.
- Success path: results accumulated by index (Tasks may resolve in any order, output must match input order); when completed === tasks.length → resolve(results).

## Why Index Matters

- Tempting alternative without index: push-based accumulation.

> [Code: naive variant — results.push(value), resolve when results.length equals task count]

- Flaw: result order = resolution order → fastest feed lands at index 0; consumers expecting input order get subtly broken behaviour under variable network timing; index approach = deterministic output regardless of resolution order.

## `processFeeds` — The Aggregator

- With Task.all built, aggregation = natural extension of what exists.

> [Code: fetch-feed.js — processFeeds: Task.all(urls.map(processFeed)) → map flat() → map sortByDateDesc]

- urls.map(processFeed) → array of Tasks, one per URL; Task.all → array of arrays (each processFeed result is an item array); .flat() merges to one array; sortByDateDesc → newest first regardless of source feed.
- Whole function returns a Task — nothing has run; fetch/parse/normalize/merge/sort all happen at .fork().

## Extending the Server

- HTTP server gets a /feeds route to expose this:

> [Code: server.js — handleMultipleFeedsRequest: getAll('url'), 400 if none, processFeeds(...trimmed urls).fork → 500 on error / sendJSON 200 on items]

- searchParams.getAll('url') collects repeated url params (/feeds?url=...&url=... → array); spread passes them as individual args into processFeeds' rest params.
- Flow: request → handler builds Task via processFeeds → fork triggers → all feeds resolved → merged result as JSON; any feed failure (bad URL, timeout, malformed feed) → error propagates immediately → 500 back.

> [Code: example GET /feeds request with NPR + The Verge URLs as repeated url params]

- Result: two feeds fetched concurrently, items merged + sorted by date, returned as one unified list.

## The Honest Limitations

- Task.all as implemented = functional but not production-hardened; gaps worth knowing:
- No cancellation: one of five fails immediately → other four keep running in background; outer reject already called so results discarded, but network requests still complete; no way to tell them to stop — genuine limitation of Tasks without cancellation semantics; libraries like Fluture solve this properly.
- No timeout: a Task that neither resolves nor rejects hangs forever; no deadline in current implementation; production → withTimeout wrapper racing the Task against a rejection after N ms.
- No settle-once guard: all Tasks share one reject handler, nothing marks the race finished → two failing feeds fire the handler twice → in the server, error response written twice; production guards handlers so first settler wins, rest ignored.
- Empty list never settles: Task.all([]) neither resolves nor rejects — completion check only runs inside a resolve handler and there are no Tasks to run it; fork it → wait forever; should resolve immediately with [] but doesn't.
- Closing point: not reasons to avoid Task in your own code — reasons to understand the tool and reach for a production library when requirements demand it.

## A Few Things to Sit With

- Before chapter nine:
- Open questions to sit with: compare server.js vs fetch-feed.js — what does each know/not know, where to fix a parsing bug vs change HTTP error formatting?; core vs shell inventory (transforms/maybe/either/task/fetch-feed = core, server.js = shell) — is the boundary clean, any leaks either way?; adding a /headlines endpoint (title + link only) — where does transform logic go, where does HTTP handling go, does the architecture make it obvious?
- Next: chapter nine steps back from code, examines the functional core / imperative shell pattern explicitly as the project's organizing principle.
