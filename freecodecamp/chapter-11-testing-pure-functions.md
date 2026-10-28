# Chapter 11: Testing Pure Functions — The Payoff — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

Central claim of last ten chapters: pure functions easy to test — not "easier," just easy.

Pure function test = three parts: plain input, function call, assert on output → no DB seeding, no server, no mocks, no teardown.

Chapter plan: walk the real suites for normalizeItem + fp-utils, how node:test works, what good pure tests look like → testing is last chapter in the sequence but first reason to structure code this way.

## Node's Built-In Test Runner

Since Node 18: built-in runner node:test → no install, no config files, no framework opinions; import test + describe, run with node --test.

> [Code: imports — test/describe from node:test, assert from node:assert/strict]

test = single case; describe = group of related tests; assert from node:assert/strict → strict equality by default, almost always what you want.

Run your tests:

> [Code: node --test command naming the two test files]

Output reports pass/fail per test with name + any assertion failures; add it to package.json:

> [Code: package.json test script running node --test over explicit src paths]

npm test runs everything; explicit paths because bash glob doesn't expand ** without globstar → listing directories is the safe approach.

## Testing `normalizeItem`

normalizeItem = most interesting function to test: multiple failure modes, each one covered.

> [Code: happy-path test — full valid input → valid:true plus deep-equal normalized data]

Two assertions: result.valid + result.data → assert.equal for the boolean (strict value), assert.deepEqual for the object (deep structure); result shape is part of normalizeItem's contract.

Now the failure cases:

> [Code: three failure tests — null item, missing title, missing link — each asserting valid:false and the exact error string]

Each test targets one failure; the error strings asserted ('Item was null', 'Title was null', 'Link was null') are the exact strings from the Either.fromNullable calls inside normalizeItem → changing a message breaks the test, forcing a deliberate update of both.

Edge case: required fields present, optional ones absent:

> [Code: test with no description/author → valid result with default summary and author]

This test documents the defaults: valid result even without optional fields, plus exactly what the defaults are.

Five tests, no server/network/mocks → node --test passes them or says exactly what's wrong.

## `assert.equal` vs `assert.deepEqual` vs `assert.strictEqual`

Comparison list: assert.equal (==, loose, primitives), assert.strictEqual (===, strings/numbers/booleans, not objects), assert.deepEqual (recursive structure compare, objects/arrays).

Rule of thumb: strictEqual for primitives, deepEqual for objects; importing assert/strict makes equal behave like strictEqual → the import path matters.

## Testing `fp-utils` with `describe`

describe groups tests under a heading → grouped output shows which area of code broke when tests fail.

> [Code: fp-utils tests in describe blocks — anyPass (incl. no-predicates case), firstOf (incl. returns-0 case), when (truthy/falsy)]

firstOf's 0 test worth examining: 0 is falsy, so a v truthiness check instead of v != null would skip it and return 'fallback' (wrong) → the test pins the edge case; pure tests document edge cases by constructing the triggering input and asserting correct behaviour.

## Tests as Specification

Specimen test names across the suite: 'normalizeItem should return valid normalized item', 'normalizeItem should return error for null item', 'anyPass returns true if any predicate passes', 'when applies the function if condition is truthy'.

Names read like a specification: names alone → reconstruct what each function does; failing name = the contract that broke.

Clear naming matters: 'works correctly' says nothing vs a name stating function + condition + expected behaviour.

## What You Don't Need

Explicitly absent from this test file: beforeEach/afterEach hooks, mock libraries, test database, HTTP client.

Every test independent, leaves no trace, any order → same results; payoff of pure business logic = tests as simple as the functions.

## A Few Things to Sit With

Sit-with questions: testing normalizeItem at the valid/data/error shape level vs testing Either-handling separately; a broken Maybe.map on Nothing could still pass normalizeItem tests → value of testing the types themselves; example-based tests vs a wider-range approach without hand-writing each case.

Ch 12 preview: tests the algebraic types directly (Maybe, Either, fp-utils) + extracting values from containers for meaningful assertions.
