# Functions All the Way Down: Chapter 9
## Separating What from How

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

The project is nearly complete. We have pure transforms, algebraic types for safe null handling and error propagation, Task for lazy async composition, and a working HTTP server that ties it together. But before we get to testing, it's worth pausing to look at the architecture as a whole.

There's a pattern running through everything we've built, and naming it makes it easier to apply deliberately in future projects.

## The Functional Core / Imperative Shell

The pattern is called the **functional core / imperative shell**, and the distinction is straightforward.

The **functional core** is made of pure functions and lazy descriptions of work. It contains all the interesting logic: data transformation, validation, filtering, sorting, error handling. Everything in the core is deterministic — same input, same output. Everything is testable without a network, without a database, without mocks.

The **imperative shell** is the thin layer that connects the core to the outside world. It fetches data, starts servers, writes to disk, handles HTTP. It has side effects by necessity — that's its job. It calls `fork` on Tasks, calls `fold` on Eithers, and translates between the functional world and the world of real I/O.

In our project, the split looks like this:

**Core:**
- `src/transforms.js` — pure data transformations
- `src/lib/maybe.js` — absent value handling
- `src/lib/either.js` — error-as-value propagation
- `src/lib/task.js` — lazy async descriptions
- `src/lib/fp-utils.js` — composable utilities
- `src/fetch-feed.js` — Tasks that describe how to fetch and process feeds (but never trigger them)

**Shell:**
- `src/server.js` — starts the HTTP server, receives requests, calls `fork`, sends responses

That's it. One file in the shell. Everything else is in the core.

## What Each Layer Knows

A cleaner way to see the boundary: what each layer knows and doesn't know about.

`transforms.js` knows what a feed item looks like and how to shape it. It doesn't know about HTTP, about URLs, or about where the data came from.

`maybe.js` and `either.js` know how to handle absent values and propagate errors. They don't know about RSS, about items, or about what fields might be missing.

`task.js` knows how to represent a lazy async computation. It doesn't know what the computation is.

`fetch-feed.js` knows how to describe the process of fetching and normalizing a feed. It imports from `task.js` and `transforms.js`. It calls `fetch` and `rss-parser`. But it never calls `fork` — it only builds descriptions.

`server.js` knows about HTTP. It translates URL parameters into function arguments, calls `processFeed` or `processFeeds`, forks the resulting Task, and translates the result or error into an HTTP response. It knows nothing about how feeds are parsed or how items are normalized.

## Why the Boundary Matters

This separation isn't just aesthetically pleasing — it has practical consequences.

**Bugs are localized.** A bug in how titles are extracted is in `transforms.js`. A bug in how HTTP errors are formatted is in `server.js`. You know where to look without tracing through the entire application. The boundary makes "where does this kind of code live?" answerable.

**The core is testable without infrastructure.** `normalizeItem`, `sortByDateDesc`, `filterByTitle` — all of these can be tested by calling them with plain values and asserting on the result. No running server. No live feed. No network mocking. The tests in chapter eleven demonstrate this.

**The shell is thin and boring.** `server.js` doesn't have complex logic — it delegates all the interesting work to the core. If something goes wrong in the shell, it's likely an HTTP concern: wrong status code, missing header, malformed response. That's a narrow failure domain.

**The core can be reused.** If you wanted to expose the same feed processing logic via a CLI instead of an HTTP server, you'd write a new shell — `cli.js` — that reads URLs from command-line arguments and writes JSON to stdout. The entire core stays unchanged.

## `fetch-feed.js`: A Hybrid Worth Examining

`fetch-feed.js` sits at an interesting point in the architecture. It wraps `fetch` and `rss-parser` — both impure operations — inside Tasks. But the Tasks themselves are lazy. `fetchFeed(url)` doesn't fetch anything; it returns a description of a fetch. `processFeed(url)` doesn't process anything; it returns a description of the entire pipeline.

This is what makes `fetch-feed.js` part of the core rather than the shell. Impurity isn't the criterion — *when* the impurity runs is. The core describes; the shell executes. Tasks allow us to describe impure operations in the core without running them there.

The rule that follows: if a file calls `fork`, it's shell code. `fetch-feed.js` never calls `fork`. `server.js` always calls `fork`. That's the clearest signal of which side of the boundary you're on.

## What "Clean Architecture" Actually Looks Like

You'll see various names for this idea in software design literature — clean architecture, hexagonal architecture, ports and adapters. The details differ, but the core principle is consistent: keep your business logic isolated from the mechanisms that connect it to the outside world.

Functional programming makes this natural rather than effortful. Pure functions *can't* have side effects by definition, so the core is inherently separated from I/O. The shell is where you cross the boundary — explicitly, deliberately, in one place.

In an object-oriented codebase, achieving this separation often requires deliberate discipline and additional abstractions (interfaces, dependency injection). In a functional codebase built with pure functions and lazy containers, it falls out of the design automatically. The architecture isn't a constraint you impose; it's a consequence of the style.

## Extending the Architecture

When you add a new feature to this project, the architecture makes the questions clear.

Adding a `/headlines` endpoint: the transformation from items to headlines is `toHeadlines` in `transforms.js`. The HTTP handling is a new handler in `server.js`. You add one function to the core, one route to the shell. They don't need to know about each other.

Adding a `filterBySummary` option to the `/feed` endpoint: the pure filter already exists in `transforms.js`. You add a `when(summary, filterBySummary(summary))` to the pipeline in `fetch-feed.js` and read the parameter in `server.js`. Two one-line changes, no structural disruption.

Adding a new data source (Atom feeds, JSON Feed): write a new `parseFeed` variant in `fetch-feed.js` that wraps the appropriate parser. The transforms and the server don't change.

The architecture absorbs changes because the boundaries are clear and the responsibilities are separated.

## A Few Things to Sit With

Before chapter eleven (which jumps straight to testing — chapter ten covers the utility library in detail):

- You've built nine chapters worth of functional code. How would you test `processFeed`? It involves network calls and a third-party parser. Would you mock those, or test a layer above and below them separately?
- `normalizeItem` is pure. `processFeed` is not — it orchestrates impure operations, even if it doesn't trigger them immediately. Does that distinction affect how you'd test each?
- The architecture has a clear answer: test the core with unit tests (pure functions, plain values, no mocks); test the shell with integration tests (actual HTTP requests, real network or network mocks). Does that match how you've thought about testing before?

Chapter eleven is where we make that payoff concrete — writing tests for the pure core using nothing but `node:test`, `assert`, and the functions themselves.
