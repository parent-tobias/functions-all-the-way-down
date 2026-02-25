# Functional Programming in Node.js: A Practical Guide
## Series Outline

This series builds a real RSS feed aggregator API from scratch using functional
programming principles. Each chapter introduces one concept and immediately applies
it to the project. By the end, you have a working server, a tested functional core,
and a clear mental model of how FP fits together in practice.

The central thesis: functional programming isn't about academic abstractions. It's
about writing code that is easier to reason about, easier to test, and easier to
compose into larger systems. We demonstrate this not by talking about it, but by
doing it.

---

## Part One: The Foundation

### Chapter 1: Pure Functions and the Rules of the Game

Before writing a single line of useful code, we establish the constraints that make
everything else possible. A pure function has two properties: given the same input,
it always returns the same output; and it produces no side effects. No logging, no
mutation, no network calls, no randomness.

This sounds restrictive. It is. That's the point. When a function can only do one
thing — transform its input into its output — it becomes trivially predictable,
trivially testable, and trivially composable. We start by writing simple feed
transforms (extracting titles, filtering by keyword) and discover that these
constraints feel natural when the domain is data transformation.

We also introduce the shape that recurs throughout the series: `input => output`,
and its curried form `config => input => output`. This is the signature of a
composable function.

**Key concepts:** referential transparency, side effects, immutability, currying.

---

### Chapter 2: Currying and Partial Application

A curried function takes its arguments one at a time, returning a new function for
each. `filterByTitle('node')` doesn't filter anything — it returns a configured
filter function, ready to be applied to any list of items. This distinction between
*configuring* a function and *running* it turns out to be enormously useful.

We build several curried transforms for the feed processor and notice a pattern:
functions configured with a keyword or category can be passed around, stored, and
composed without knowing in advance what data they'll process. This is partial
application, and it is the mechanism that makes composition practical.

**Key concepts:** currying, partial application, higher-order functions.

---

### Chapter 3: Function Composition with `pipe`

If pure functions are Lego bricks, composition is how you connect them. `pipe`
takes a list of functions and returns a new function that passes its input through
each one in turn. The output of each function becomes the input of the next.

We build `pipe` from scratch using `reduce`, and the connection between the two
becomes clear: `reduce` is `pipe` for values; `pipe` is `reduce` for functions.
We refactor our index.js to use a pipeline, and observe that the resulting code
reads almost like a description of what it does, not instructions for how to do it.
This is point-free style — functions defined by their composition rather than their
arguments.

**Key concepts:** composition, pipe vs compose, point-free style, reduce.

---

## Part Two: Algebraic Types

### Chapter 4: Maybe — Safe Null Handling

`null` is a billion-dollar mistake. The defensive null-check pattern (`if (value)
{ ... }`) scatters conditionals throughout the codebase and silently swallows errors
when forgotten. Maybe offers an alternative: wrap potentially-absent values in a
container that handles the absence automatically.

We build Maybe from scratch — a `Just` that holds a value and a `Nothing` that
holds nothing, both with the same interface. Code that calls `.map()` on a Maybe
doesn't know or care whether it has a value; if it's a Nothing, the transformation
is silently skipped and a Nothing comes out the other end. We apply this to author
name normalization in the feed processor, where the author field might be absent,
a string, or an object with a `name` property.

**Key concepts:** Maybe/Just/Nothing, null safety, map over containers, `getOrElse`.

---

### Chapter 5: `map` vs `chain` — The Key Distinction

Once you understand `map`, you'll inevitably reach for it in situations where it
doesn't quite work. If the function you're mapping returns a Maybe (or Either, or
any wrapped value), `map` gives you a nested wrapper — `Just(Just(x))` — which is
not what you want. `chain` (also called `flatMap` or `bind`) is the solution: like
`map`, but it flattens the result.

This chapter takes the time to make this distinction concrete through examples and
deliberate mistakes. The mental model: `map` is for functions that always succeed;
`chain` is for functions that might fail or return a wrapped value. If `map` is
multiplication, `chain` is what prevents the brackets from accumulating.

**Key concepts:** map vs chain (flatMap), nested monads, monad laws.

---

### Chapter 6: Either — Errors as Values

Maybe tells you something is absent. Either tells you *why*. A `Right` holds a
successful value; a `Left` holds an error. Like Maybe, both have the same interface,
so transformations chain through `Right` values while `Left` values propagate
unchanged — the first failure wins.

We build Either from scratch and use it to validate and normalize feed items in
`normalizeItem`. Each validation step either passes the item forward (Right) or
captures the specific error (Left: "Title was null", "Link was null"). We introduce
`fold` as the escape hatch — the only way to get a plain value out of an Either,
forcing you to handle both cases explicitly at the boundary. This is railway
oriented programming: two tracks, and failures switch you to the error track
permanently.

**Key concepts:** Either/Right/Left, error as value, fold, railway oriented
programming, the boundary principle.

---

## Part Three: Async and the Real World

### Chapter 7: Task — Lazy Async Computation

Promises are eager: the moment you create one, it starts executing. Tasks are lazy:
nothing happens until you explicitly call `.fork()`. This laziness is what makes
Task composable in the same way as Maybe and Either — you can build up a pipeline
of async operations without triggering any of them, and only execute the whole
thing when you're ready.

We build Task from scratch and discover that `map` and `chain` work exactly the
same way as they do for Maybe and Either. A Task that fetches a URL, parses RSS,
and normalizes items is just three operations composed together. `fork` is our
escape hatch — the async equivalent of `fold`. We discuss the imperative shell
pattern: the functional core never calls `fork`; only the outermost boundary of
the application does.

**Key concepts:** Task, laziness vs eagerness, fork, async composition, Task vs
Promise.

---

### Chapter 8: Task.all — Concurrent Operations

With a single `processFeed` Task established, aggregating multiple feeds is
surprisingly clean: map each URL to a Task, collect them, run them concurrently
with `Task.all`, and flatten the results. We build `Task.all` from scratch,
examining exactly how immediate rejection works and why the index-based result
accumulation is necessary for preserving order.

We extend the HTTP server with a `/feeds` endpoint that accepts multiple URL
parameters, processes them concurrently, merges the results, and sorts by date.
We also discuss the honest limitations of our `Task.all` — no cancellation, no
timeout semantics — and what production solutions look like.

**Key concepts:** Task.all, concurrency, fail-fast, processFeeds, REST API design.

---

## Part Four: The Functional Core, Imperative Shell

### Chapter 9: Separating What from How

The functional core, imperative shell pattern is the architectural principle tying
everything together. The functional core contains all the logic — pure functions,
algebraic types, deterministic transforms. The imperative shell is the thin layer
that connects the core to the outside world: HTTP, file I/O, databases, clocks.

We examine how the feed processor embodies this pattern. `transforms.js` is pure.
`fetch-feed.js` builds lazy Tasks but never triggers them. `server.js` is the
only file that talks to the network, starts the server, and calls `fork`. A bug in
the business logic is always in the core; a bug in HTTP handling is always in the
shell. The boundary is clear, the responsibilities are separated, and neither layer
knows about the internals of the other.

**Key concepts:** functional core/imperative shell, boundary principle, separation
of concerns, architectural layers.

---

### Chapter 10: Utility Libraries and Reusability

As the project grows, patterns emerge that belong to no specific domain — coalescing
field names, conditionally applying transforms, combining predicates. We extract
these into `fp-utils.js`, a domain-agnostic library of reusable utilities.

`firstOf` implements the coalesce pattern: try several field names, return the first
non-null value. `when` conditionally applies a function or passes the value through
unchanged — useful for optional pipeline steps. `anyPass` combines predicates with
OR logic, enabling search across multiple fields in a single filter pass. Each
utility is a small, focused function; together they form a vocabulary for building
pipelines.

**Key concepts:** utility extraction, coalesce pattern, predicate combinators,
conditional pipelines.

---

## Part Five: Testing

### Chapter 11: Testing Pure Functions — The Payoff

The central claim of functional programming is that pure functions are easy to test.
This chapter makes that concrete. A pure function test has three parts: a plain
input, a function call, and an assertion about the output. No database, no network,
no mocks, no test doubles, no setup, no teardown.

We introduce Node's built-in `node:test` module and write our first tests for
`normalizeItem`. The tests are so simple they feel almost too easy — and that's
exactly the point. We explore `assert.equal`, `assert.deepEqual`, and
`assert.strictEqual`, and discuss when each is appropriate. We also introduce
`describe` for grouping tests by function, producing output that reads like a
specification.

**Key concepts:** pure function testing, node:test, assert, describe/test,
tests as documentation.

---

### Chapter 12: Testing Algebraic Types

Testing Maybe, Either, and fp-utils requires slightly different thinking because
the values are wrapped. We can't assert on the container directly — we need to
extract the value. For Maybe, `getOrElse` with a sentinel value tells us whether
we got a Just or Nothing. For Either, `fold` forces us to handle both paths and
lets us assert on the result of each.

We write test suites for all three lib modules and discover that testing the types
documents the monad laws themselves: map on Nothing returns Nothing, Left propagates
through chain, `getOrElse` returns the default only when absent. The tests become
a formal specification of the types' behaviour, not just a regression safety net.

We also examine the trap of testing via `inspect()` strings, and why asserting on
actual values is more robust and more meaningful.

**Key concepts:** testing wrapped values, getOrElse as extraction, fold as
extraction, sentinel values, tests as specification.

---

### Chapter 13: TDD with Functional Programming

Test-driven development and functional programming are natural partners. The classic
red-green-refactor cycle fits pure functions better than it fits objects: writing a
test first forces you to think about the function's contract before its
implementation, and pure functions have no implicit state to set up.

We discuss when TDD is most valuable in an FP codebase (building utilities and
algebraic types, adding new edge cases), when it's less natural (exploratory code,
async boundary code), and what discipline looks like in practice. The key habit
isn't dogmatic test-first — it's that tests exist, they run, and they tell the
truth about the code.

**Key concepts:** TDD, red-green-refactor, test discipline, testing at boundaries.

---

## Appendix: Where to Go Next

- **Ramda**: Compare the utilities you built by hand against a production FP library
- **Fluture**: A mature Task implementation with cancellation semantics
- **Fantasy Land**: The specification that formalises the algebraic structures used here
- **fp-ts / Effect**: Full FP in TypeScript, where types enforce the laws
- **Property-based testing**: Testing the monad laws themselves with generated inputs
- **The Mostly Adequate Guide to Functional Programming**: Professor Frisby's free book
