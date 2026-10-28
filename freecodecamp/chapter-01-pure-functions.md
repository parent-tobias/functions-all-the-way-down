# Chapter 1: Pure Functions and the Rules of the Game — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

Opening scenario → function works in isolation, misbehaves inside the real app (different results per call, silent mutation causing distant bugs).

Framing → design problem, not skill problem; FP disciplines target exactly this.

Series setup → build a real Node.js RSS/news feed aggregator API together; no frameworks, ES modules, Node 22 built-in fetch; this chapter = rules of the game, starting with pure functions.

## What Makes a Function "Pure"?

Purity = exactly two rules.

Rule 1 → same input always → same output, no exceptions (e.g. getTitles on same array → same titles).

Rule 2 → no side effects: no DB writes, no mutating input, no API calls, no localStorage, no console logs; input in, output out, world untouched.

Two rules only, but consequences of following them consistently are large.

## The Problem with Impure Code

Set up example → extract titles from RSS items, naively written version.

> [Code: impure extractTitles writing results into shared outer variable processedItems]

Problem → function writes outside itself = side effect; shared variable now depends on last call timing; dependents inherit that fragility; testing requires managing external state first.

> [Code: pure one-line getTitles mapping items to titles, no external state]

Same result, no shared state → callable any number of times with same input → same output; test = pass array in, assert what comes back.

## Currying: Configuration Without Side Effects

Bridge → pure functions get interesting when configurable without external state; enter currying.

Definition → function takes configuration first, returns function that takes the data; shape: config => data => result.

Contrast → naive filter reads search term from stored state vs curried filter takes it as argument.

> [Code: curried filterByTitle taking searchTerm, returning items filter, case-insensitive title match]

Result → calling filterByTitle returns a specialized filter function; search term captured in closure, not a shared variable.

> [Code: two specialized filters built from filterByTitle ('node', 'security') applied independently to same feedItems]

Each specialized filter is itself pure → always filters same way for same input; unlimited instances, zero interference.

## The Functional Core / Imperative Shell

Caveat → whole apps can't be pure; fetching, file writes, HTTP responses are inherently impure.

Solution → be deliberate about where impurity lives: functional core / imperative shell split.

List → core = pure functions (transform, filter, sort, shape; most logic; testable without mocks) / shell = outside-world layer (fetch, disk, HTTP) that orchestrates the core with real data.

Applied here → shell = small entry point fetching feeds, passing raw data into core; core does the transformational work; this chapter starts the core.

## Building `transforms.js`

Intro → write first project module: foundational pure transforms shaping raw RSS data.

> [Code: src/transforms.js — getTitles, getLinks, curried filterByTitle, sortByDateDesc copying array before sorting]

Callout → sortByDateDesc spreads into a new array first because Array.prototype.sort mutates in place; habit: copy before any mutating native method.

Summary → all four take data in, return new value, touch nothing outside themselves → all pure.

## Testing Pure Functions Is Straightforward

Payoff → no server, seeded DB, or mocks needed to test pure functions; Node 22's built-in node:test suffices.

> [Code: src/transforms.test.js — sample items plus tests for getTitles output, case-insensitive filterByTitle, sortByDateDesc non-mutation]

Run note → node --test passes with zero setup; tests nearly as simple as the functions themselves.

## A Few Things to Sit With

Lead-in → questions to consider before chapter 2.

List → (1) chaining several transforms in sequence — more elegant than nesting? / (2) which other transforms could use the config => data => result currying treatment, configured how? / (3) how exactly should the shell call the core once fetch returns real data — what does the boundary look like in code?

Next chapter → pull thread 2: currying deeper, partial application — functions configured once, passed around, stored, applied where needed.
