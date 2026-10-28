# Chapter 3: Function Composition with `pipe` — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

Recall → chapter 2's chaining question: several items => result functions (filter, sort, extract) to run in sequence.

> [Code: nested call getTitles(sortByDateDesc(filterByTitle('node')(items))) — the current chaining approach]

Problem → execution runs right-to-left while code reads left-to-right → mental unwinding; only 3 functions here, worse at 4–5.

Hook → a better way exists.

## What `pipe` Is

Definition → pipe takes a list of functions, returns a new function; calling it threads a value through each function in turn, output → next input.

> [Code: pipeline built with pipe (filterByTitle('node'), sortByDateDesc, getTitles) then applied to feedItems]

Reading → executes left-to-right, same direction as reading; data flow matches code flow; no unwinding.

Relation → pipe = inverse of mathematical compose (right-to-left); same idea, more readable order; pipe used throughout the project.

## Building `pipe` from Scratch

Lead-in → the implementation.

> [Code: pipe implemented as rest params + reduce threading the accumulator through each function]

Reaction → that's the whole thing; now read it closely.

Walkthrough → rest params collect functions; returned function takes one value x; reduce over the functions starting from x, each step applies current function to accumulated value and passes result forward.

Key connection → reduce threads a value through a list of operations — exactly pipe's job; difference = operations are functions, not arithmetic; reduce is pipe for values, pipe is reduce for functions.

Variant note → compose implemented identically but with reduceRight.

> [Code: compose implemented with reduceRight]

Contrast → compose(f, g, h)(x) = f(g(h(x))), mathematical right-to-left / pipe(f, g, h)(x) = f then g then h, reading order; both live in fp-utils.js, pipe is the default from here.

## Using `pipe` with Our Transforms

Application → refactor any transform sequence into a readable pipeline; example goal = most recent Node news → their titles.

> [Code: getLatestNodeTitles built with pipe from filterByTitle('node'), sortByDateDesc, getTitles; applied later to feedItems]

Properties → getLatestNodeTitles is pure, assembled entirely from smaller pure functions; same input → same output, testable without mocks, reads like a description of what it does.

Why it works → shapes align: filterByTitle('node') is items => items, sortByDateDesc is items => items, getTitles is items => something else → they snap together; pipe itself knows nothing about feeds/dates/keywords, just threads values.

## Point-Free Style

Observation → getLatestNodeTitles never mentions items in its definition.

> [Code: same function two ways — explicit items parameter with nested calls vs point-free pipe version]

Equivalence → both identical; second style = point-free: define by transformation, not by argument ("point" = the argument, math holdover).

Explanation → point-free is a side effect, not a goal: consistent shapes (data => result, config => data => result) snap into pipelines without naming the data; code describes what happens, not step-by-step how.

Caution → overusable: ten obscurely named functions in a pipeline = unreadable; use where it aids clarity only.

## Updating `fp-utils.js`

Placement → pipe and compose live in fp-utils.js alongside other reusable utilities (getProp, pluck, more coming).

> [Code: src/lib/fp-utils.js so far — compose, pipe, getProp, pluck]

Note → pipe/compose are domain-agnostic pure functions operating on functions, knowing nothing of RSS data shapes → exactly what belongs in a shared module.

## A Note on `index.js`

Scratchpad role → index.js wires things together for trying pipelines without HTTP machinery.

> [Code: src/index.js — sample items, getLatestNodeTitles pipeline, console.log output sorted newest-first]

Behaviour note → run with node src/index.js; output newest-first because sortByDateDesc precedes getTitles; swapping them errors because getTitles returns strings without pubDate → shapes enforce natural order.

## The Assumption Inside `pipe`

Why it works here → every pipeline step takes an array, returns an array; shapes match, data flows cleanly.

Hidden assumption → pipe assumes every step succeeds; null into filterByTitle throws, missing title crashes on .toLowerCase(); pipe has no concept of a step not working.

Reality check → fine for pure transforms over clean data; real data is messy — missing author/description/title, failed requests, absent values → pipe alone lacks the tools.

Rejected fix → if-checks inside every function scatter checking through the pipeline and destroy the composability just built.

Actual direction → change what flows through the pipe, not the functions.

Container idea → pass a container that knows whether it holds a value; functions unchanged, container handles absence — skips steps with no meaningful input, carries absence to the end.

Roadmap → next chapters build these containers, one per kind of uncertainty; pipe dissolves into them as map and chain; composition stays, pipeline gets smarter about its cargo.

## A Few Things to Sit With

Lead-in → questions before chapter 4.

List → (1) all functions so far assume values present, but feeds are messy (missing author/description/title) — handle absence without scattering if (value !== null) checks everywhere? / (2) checking per step vs wrapping possibly-absent values in a container that handles absence — what would that container look like? / (3) author field varies: string, object with name property, or missing entirely — a pure normalizer must handle all three without crashing; how?

Next chapter → Maybe: a small container handling absent values gracefully, transformations working identically whether a value is present or not.
