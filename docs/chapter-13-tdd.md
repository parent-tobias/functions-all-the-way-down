# Functions All the Way Down: Chapter 13
## TDD with Functional Programming

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

Test-driven development and functional programming are often discussed together, and for good reason. But the pairing deserves more nuance than "always write tests first." TDD isn't a law; it's a technique. Understanding *when* it helps and when it doesn't is more useful than applying it uniformly.

This final chapter of the testing part is about discipline: what good testing looks like in an FP codebase, when writing tests first is genuinely valuable, and what the ongoing practice of maintaining a functional test suite actually involves.

## The Classic Loop: Red, Green, Refactor

TDD's core cycle has three steps. **Red**: write a failing test before writing any code. **Green**: write the minimum code to make it pass. **Refactor**: clean up, knowing the test will catch regressions.

The reason TDD works is that it forces you to think about the function's *contract* before its implementation. What goes in? What comes out? What are the edge cases? Writing the test first means answering these questions before you're committed to an implementation that might make them awkward to answer.

For pure functions, this maps naturally. The contract is exactly what a pure function is: input and output. Writing `normalizeItem` test-first would start like this:

```js
// Write this before normalizeItem exists
test('normalizeItem returns valid result for a complete item', () => {
  const result = normalizeItem({
    title: 'Test',
    link: 'http://example.com',
    description: 'A test item',
    pubDate: '2024-01-01',
  });

  assert.equal(result.valid, true);
  assert.equal(result.data.title, 'Test');
});
```

This test fails immediately — `normalizeItem` doesn't exist yet. Now you implement it. The test tells you the exact shape your output needs to have. You're not guessing what the consumer expects; the test specifies it.

## When TDD Is Most Valuable in an FP Codebase

**Building utilities and algebraic types.** If you're implementing `firstOf` or `when` or a new monad method, TDD is excellent. The expected behaviour is well-defined before you start: `firstOf('a', 'b')({a: null, b: 'value'})` should return `'value'`. Write the test, watch it fail, implement the function, watch it pass. The cycle is tight and satisfying.

**Adding edge cases to existing functions.** You realise `firstOf` has an edge case worth pinning down: `0`. Because `0` is falsy, an implementation that tested `v` for truthiness instead of `v != null` would skip it and return the fallback; the `v != null` check is precisely what makes `0` count as a present value. Write the test that documents the distinction:

```js
test('firstOf returns 0 if that is the first non-null value', () => {
  const obj = { a: 0, b: 'fallback' };
  assert.strictEqual(firstOf('a', 'b')(obj), 0);
});
```

This test passes against `v != null` — and it would fail if anyone ever "simplified" that check to a truthiness test. That's the point of writing it: you now have documentation of the edge case that will prevent regressions.

**Implementing the monad laws.** Writing the left-identity and right-identity tests before implementing `chain` forces you to understand what correct behaviour looks like before writing code that might subtly violate the laws.

## When TDD Is Less Natural

**Exploratory code.** When you're not sure what a function should do yet — you're experimenting with the shape of the data, trying different approaches — writing tests first slows you down. Tests imply a commitment to a specific contract. Exploration doesn't have a contract yet. Prototype first, test when the design stabilizes.

**Async boundary code.** Testing Task and Promise-based code requires handling callbacks, which adds ceremony. `node:test` supports async tests with `async/await`, but it's more involved than synchronous pure function tests. The shell code in `server.js` is better tested with integration tests — actual HTTP requests against a running server — than unit tests.

**One-shot glue code.** If you're wiring two existing functions together in a way that's too simple to fail meaningfully, a test adds noise without value. Trust the component tests of the individual parts.

## What the Discipline Actually Looks Like

TDD's value isn't primarily in the tests themselves. It's in the habit of thinking about contracts before implementations. You can practice that habit without strictly writing tests before code, as long as you're thinking about inputs, outputs, and edge cases upfront.

The real discipline is this: **the tests exist, they run, and they tell the truth about the code.**

That means:
- Tests run in CI or on every `npm test`, not just occasionally
- Test names describe behaviour, not implementation details
- Tests fail when the behaviour breaks, not just when the implementation changes
- Edge cases are documented as tests, not just as comments

In this project, that's: five tests for `normalizeItem`, covering the happy path, three failure modes, and the optional-field defaults. Tests for each `fp-utils` function, including the falsy-value edge case in `firstOf`. Tests for every significant behaviour of Maybe and Either.

That's not exhaustive coverage — `Task` isn't tested, `sortByDateDesc` only has one test, `filterByTitle` and friends aren't in a formal test. That's fine. The tests you have cover the complex code. The simple code speaks for itself.

## The Connection to Refactoring

Here's a concrete scenario. Suppose you want to refactor `normalizeItem` to extract the validation logic into smaller functions:

```js
const checkItem  = item => Either.fromNullable(item, 'Item was null');
const checkTitle = i    => Either.fromNullable(i.title, 'Title was null').map(title => ({ ...i, title }));
const checkLink  = i    => Either.fromNullable(i.link, 'Link was null').map(link => ({ ...i, link }));

export const normalizeItem = item =>
  checkItem(item)
    .chain(checkTitle)
    .chain(checkLink)
    .map(toNormalizedShape)
    .fold(
      err  => ({ valid: false, error: err }),
      data => ({ valid: true, data })
    );
```

The tests don't care about this refactoring. They call `normalizeItem` with specific inputs and assert on the results. They test the contract, not the implementation. You refactor, run `npm test`, and if the tests pass, the contract is preserved.

This is the reason for testing at the right level of abstraction. Tests for `checkItem` directly would break when you rename it. Tests for `normalizeItem`'s behaviour survive refactoring as long as the behaviour doesn't change.

## Functional Programming as Test-Friendly Design

Here's the observation that ties everything together. The functional programming principles we've applied throughout this series — pure functions, immutability, no side effects in the core, lazy descriptions of I/O — are the same properties that make code easy to test.

If a function is pure, you can test it with plain values. If data is immutable, tests don't interfere with each other. If side effects are confined to the shell, you can test the core without infrastructure. If async operations are described lazily, you can compose and test the descriptions separately from their execution.

You didn't structure the code this way *for testing*. You structured it this way because pure functions are predictable, because immutability prevents accidental mutation, because the functional core / imperative shell pattern makes responsibilities clear. The testability is a consequence of the design, not the goal.

That's the most important thing to take from this part of the series: the techniques aren't testing techniques. They're design techniques. The tests are what you get when the design is right.

## What Comes Next

That closes the testing part — but not the series. So far we've built a toolkit and a tested functional core, and mostly exercised them piece by piece. If one thing from these testing chapters sticks, make it this: pure functions are not a constraint you impose on yourself as discipline. They're the natural result of writing functions that do exactly one thing — transform their input into their output — and nothing else. Everything else follows.

Part Six is where the patterns stop being exercises and start being put to work. Chapter fourteen builds a complete new feature — the `/digest` endpoint, a summary of a feed: item count, date range, top categories, recent headlines — and builds it the way these chapters have argued for: designed first, the pure core written test-first and fully exercised before any async work is touched. Then the chapters after it wire that feature into the server, and find out what the patterns do when synchronous validation has to hand off to asynchronous work.

That's the real test of everything so far — not whether the tests pass, but whether a new feature feels like building, or like plumbing.
