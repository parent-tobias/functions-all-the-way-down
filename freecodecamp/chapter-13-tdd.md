# Chapter 13: TDD with Functional Programming — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

TDD and FP are often paired, for good reason, but the pairing needs nuance: TDD is a technique, not a law → when it helps vs doesn't beats applying it uniformly.

Final testing chapter = discipline: what good testing looks like in an FP codebase, when tests-first is genuinely valuable, what maintaining a functional test suite involves in practice.

## The Classic Loop: Red, Green, Refactor

Core cycle, three steps: Red = failing test before any code; Green = minimum code to pass; Refactor = clean up with the test catching regressions.

TDD works because it forces contract-before-implementation thinking: inputs, outputs, edge cases answered before an implementation makes them awkward to answer.

For pure functions this maps naturally — the contract is exactly input → output; normalizeItem test-first would start like:

> [Code: test-first normalizeItem test — complete item in, asserts valid:true and data.title — written before normalizeItem exists]

Test fails immediately (no normalizeItem yet) → implement it; the test specifies the exact output shape, so consumer expectations are specified, not guessed.

## When TDD Is Most Valuable in an FP Codebase

Building utilities and algebraic types: behaviour well-defined before you start (e.g. firstOf('a','b') on {a:null, b:'value'} → 'value') → write test, watch fail, implement, watch pass; tight, satisfying cycle.

Adding edge cases to existing functions: firstOf's 0 case — 0 is falsy so a truthiness check on v would skip it and return the fallback; v != null is precisely what makes 0 count as present; write the test documenting the distinction:

> [Code: test — firstOf returns 0 when 0 is the first non-null value]

Test passes against v != null and would fail if anyone "simplified" it to truthiness → documentation that prevents regressions.

Implementing the monad laws: left/right identity tests before chain force understanding of correct behaviour before writing code that might subtly violate the laws.

## When TDD Is Less Natural

Exploratory code: shape/behaviour not yet known, tests imply commitment to a contract that doesn't exist yet → prototype first, test when the design stabilizes.

Async boundary code: Task/Promise tests need callback ceremony (node:test async/await helps but is heavier) → server.js shell better served by integration tests (real HTTP against a running server) than unit tests.

One-shot glue code: wiring two existing functions too simply to fail meaningfully → a test adds noise, not value; trust the parts' component tests.

## What the Discipline Actually Looks Like

TDD's value is the contract-first habit, not primarily the tests; the habit is practicable without strict tests-first as long as inputs/outputs/edge cases are thought through upfront.

Real discipline: the tests exist, they run, and they tell the truth about the code.

Truth-telling means: tests run in CI or on every npm test (not occasionally); names describe behaviour not implementation; tests fail when behaviour breaks, not merely when implementation changes; edge cases documented as tests, not comments.

In this project: five normalizeItem tests (happy path, three failure modes, optional-field defaults); tests per fp-utils function incl. firstOf's falsy edge; every significant Maybe/Either behaviour.

Not exhaustive — Task untested, sortByDateDesc one test, filterByTitle and friends untested formally — and that's fine: complex code covered, simple code speaks for itself.

## The Connection to Refactoring

Scenario: refactor normalizeItem by extracting validation into smaller functions:

> [Code: refactored normalizeItem — checkItem/checkTitle/checkLink as fromNullable Eithers chained into toNormalizedShape, folded to the valid/error result]

Tests don't care: they call normalizeItem and assert on results — contract, not implementation → refactor, run npm test, pass = contract preserved.

Right abstraction level matters: tests on checkItem directly break on rename; behaviour tests on normalizeItem survive any refactoring that preserves behaviour.

## Functional Programming as Test-Friendly Design

Tie-together observation: the series' principles (pure functions, immutability, no side effects in the core, lazy I/O descriptions) are the same properties that make code easy to test.

Pure → test with plain values; immutable → tests don't interfere; effects confined to shell → core testable without infrastructure; lazy async descriptions → compose/test the descriptions separately from execution.

The code wasn't structured this way for testing but for predictability, no accidental mutation, and clear core/shell responsibilities → testability is a consequence of the design, not the goal.

Key takeaway: these are design techniques, not testing techniques; the tests are what you get when the design is right.

## What Comes Next

Testing part closes, series doesn't: toolkit + tested functional core built, mostly exercised piecemeal; the one thing to keep — pure functions aren't self-imposed discipline but the natural result of functions doing exactly one thing (input → output) and nothing else; everything else follows.

Part Six preview: patterns put to work — Ch 14 builds a complete feature (/digest: item count, date range, top categories, recent headlines) designed first, pure core test-first and fully exercised before any async; later chapters wire it into the server, where sync validation hands off to async work.

That's the real test of everything so far: not whether tests pass, but whether a new feature feels like building or like plumbing.
