# Chapter 9: Separating What from How — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

- Project nearly complete: pure transforms, algebraic types for null handling + error propagation, Task for lazy async, working HTTP server tying it together; pause before testing to look at the architecture whole.
- A pattern runs through everything built so far; naming it → easier to apply deliberately in future projects.

## The Functional Core / Imperative Shell

- Pattern named: functional core / imperative shell; distinction is straightforward.
- Functional core = pure functions + lazy descriptions of work; holds all interesting logic (transformation, validation, filtering, sorting, error handling); deterministic — same input, same output; testable without network/database/mocks.
- Imperative shell = thin layer connecting core to outside world; fetches data, starts servers, writes disk, handles HTTP; side effects by necessity — that's its job; calls fork on Tasks, fold on Eithers, translates between functional world and real I/O.
- The split in this project:
- Core files: transforms.js (pure data transformations), lib/maybe.js (absent values), lib/either.js (error-as-value), lib/task.js (lazy async descriptions), lib/fp-utils.js (composable utilities), fetch-feed.js (Tasks describing fetch/process, never triggering them).
- Shell files: server.js only — starts HTTP server, receives requests, calls fork, sends responses.
- Punchline: one file in the shell; everything else is core.

## What Each Layer Knows

- transforms.js: knows feed item shape + how to shape it; doesn't know HTTP, URLs, or data origin.
- maybe.js / either.js: know absent-value handling + error propagation; don't know RSS, items, or which fields might be missing.
- task.js: knows how to represent a lazy async computation; doesn't know what the computation is.
- fetch-feed.js: knows how to describe fetching + normalizing a feed; imports task.js + transforms.js; calls fetch and rss-parser; never calls fork — builds descriptions only.
- server.js: knows HTTP; translates URL params → function args, calls processFeed/processFeeds, forks the Task, translates result/error → HTTP response; knows nothing about parsing or normalization.

## Why the Boundary Matters

- Separation isn't just aesthetic — practical consequences:
- Bugs are localized: title-extraction bug → transforms.js; HTTP error formatting bug → server.js; "where does this kind of code live?" is answerable without tracing the whole app.
- Core testable without infrastructure: normalizeItem, sortByDateDesc, filterByTitle → call with plain values, assert on result; no running server, no live feed, no network mocking; chapter eleven tests demonstrate this.
- Shell is thin and boring: server.js holds no complex logic, delegates interesting work to core; shell failures = narrow domain (wrong status code, missing header, malformed response).
- Core is reusable: same feed logic via CLI instead of HTTP → write a new shell (cli.js reading URLs from args, writing JSON to stdout); entire core unchanged.

## `fetch-feed.js`: A Hybrid Worth Examining

- fetch-feed.js wraps fetch + rss-parser (both impure) inside Tasks — but Tasks are lazy: fetchFeed(url) fetches nothing, returns a description; processFeed(url) processes nothing, returns a description of the whole pipeline.
- That's why it belongs to the core, not the shell: impurity isn't the criterion — when the impurity runs is; core describes, shell executes; Tasks let the core describe impure ops without running them.
- Resulting rule: a file that calls fork is shell code; fetch-feed.js never forks, server.js always forks — clearest signal of which side of the boundary you're on.

## What "Clean Architecture" Actually Looks Like

- Same idea under other names in design literature: clean architecture, hexagonal architecture, ports and adapters — details differ, core principle consistent: business logic isolated from the mechanisms connecting it to the outside world.
- FP makes this natural rather than effortful: pure functions can't have side effects by definition → core inherently separated from I/O; shell = where you cross the boundary, explicitly/deliberately/in one place.
- Contrast OOP: separation needs deliberate discipline + extra abstractions (interfaces, dependency injection); in a functional codebase of pure functions + lazy containers it falls out of the design automatically — architecture as consequence of style, not imposed constraint.

## Extending the Architecture

- New features → the architecture makes the questions clear.
- /headlines endpoint: item→headline transform = toHeadlines in transforms.js; HTTP handling = new handler in server.js; one function in core + one route in shell, neither needs to know about the other.
- filterBySummary option on /feed: pure filter already exists in transforms.js; add when(summary, filterBySummary(summary)) to the fetch-feed.js pipeline + read the param in server.js; two one-line changes, no structural disruption.
- New data source (Atom, JSON Feed): new parseFeed variant in fetch-feed.js wrapping the right parser; transforms and server unchanged.
- Why it works: architecture absorbs changes because boundaries are clear and responsibilities separated.

## A Few Things to Sit With

- Before chapter eleven (testing — chapter ten covers the utility library in detail):
- Open questions to sit with: testing processFeed — it involves network + third-party parser, mock those or test layers above/below separately?; normalizeItem is pure, processFeed only orchestrates impure ops without triggering them — does that distinction change how you'd test each?; architecture's answer = unit tests for core (pure fns, plain values, no mocks) + integration tests for shell (real HTTP requests, real network or network mocks) — does that match your prior thinking about testing?
- Next: chapter eleven makes the payoff concrete — tests for the pure core using only node:test, assert, and the functions themselves.
