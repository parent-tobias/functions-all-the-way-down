# Functions All the Way Down: Chapter 12
## Testing Algebraic Types

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

Testing pure functions with plain values is straightforward — you pass in an array, you get back an array, you assert on the contents. Testing algebraic types is slightly different, because the values are wrapped. You can't just assert directly on a `Just` or a `Right`; you need to extract the value first.

This chapter covers the test suites for Maybe, Either, and `fp-utils`. Along the way, it addresses a subtle trap — using `inspect()` as a test assertion — and explains why the extraction-first approach produces better tests.

## The Wrong Way: Testing `inspect()` Strings

When you're working in the console and want to see what a Maybe looks like, `.inspect()` is convenient:

```js
Maybe.of(5).inspect()  // 'Just(5)'
Maybe.nothing().inspect()  // 'Nothing'
```

It's tempting to use this in tests:

```js
// Don't do this
assert.strictEqual(Maybe.of(5).map(x => x * 2).inspect(), 'Just(10)');
```

This works, but it's fragile. It's testing the string representation of the container, not the value inside it. If you ever change how `inspect()` formats its output — even just adding a space — every test that asserts on inspect strings breaks, even if the behaviour is completely correct. You're testing an implementation detail of a debugging utility.

The better approach: extract the value and assert on that.

## Testing Maybe: `getOrElse` as the Extractor

For Maybe, `getOrElse` is the extraction mechanism. Pass it a sentinel value — something that couldn't plausibly be a real result — and you can distinguish `Just` from `Nothing` without touching `inspect()`.

```js
// src/lib/maybe.test.js
import { test, describe } from 'node:test';
import assert from 'assert';
import { Maybe } from './maybe.js';

describe('Maybe', () => {
  test('Maybe.of creates a Just value', () => {
    const maybeValue = Maybe.of(5);
    assert.strictEqual(maybeValue.getOrElse(null), 5);
  });

  test('Maybe.nothing creates a Nothing value', () => {
    const maybeValue = Maybe.nothing();
    assert.strictEqual(maybeValue.getOrElse('nothing there'), 'nothing there');
  });

  test('Maybe.map applies a function to a Just value', () => {
    const result = Maybe.of(5).map(x => x * 2).getOrElse(null);
    assert.strictEqual(result, 10);
  });

  test('Maybe.map does not apply a function to Nothing', () => {
    const result = Maybe.nothing().map(x => x * 2).getOrElse('nothing there');
    assert.strictEqual(result, 'nothing there');
  });

  test('Maybe.chain allows chaining operations that return Maybe', () => {
    const result = Maybe.of(5)
      .chain(x => Maybe.of(x * 2))
      .chain(x => Maybe.of(x + 3))
      .getOrElse(null);
    assert.strictEqual(result, 13);
  });

  test('Maybe.chain short-circuits if any operation returns Nothing', () => {
    const result = Maybe.of(5)
      .chain(x => Maybe.nothing())
      .chain(x => Maybe.of(x + 3))
      .getOrElse('nothing there');
    assert.strictEqual(result, 'nothing there');
  });
});
```

Every test ends with `.getOrElse(something)` — that's where the value comes out. The sentinel value serves double duty: if the Maybe is a `Just`, you get the actual value back and the sentinel is ignored. If it's `Nothing`, you get the sentinel, which means the assertion either passes (if you expected `Nothing`) or fails (if you expected a `Just`).

The test ordering matters too. `Maybe.of` and `Maybe.nothing` are tested first, before `map` and `chain`. Those later tests depend on the constructor behaviour being correct — if `Maybe.of` doesn't work, `map` tests are meaningless. Testing dependencies in order makes failures easier to diagnose.

## Testing Either: `fold` as the Extractor

Either uses `fold` for extraction — which is actually more expressive than `getOrElse`, because you handle both the `Left` and `Right` cases explicitly.

```js
// src/lib/either.test.js
import { test, describe } from 'node:test';
import assert from 'assert';
import { Either } from './either.js';

describe('Either', () => {
  test('Either.of(5) should be Right(5)', () => {
    const result = Either.of(5).fold(
      err => ({ type: 'Left', value: err }),
      val => ({ type: 'Right', value: val })
    );
    assert.deepStrictEqual(result, { type: 'Right', value: 5 });
  });

  test('Either.fromNullable(null) should be Left("Value was null")', () => {
    const result = Either.fromNullable(null).fold(
      err => ({ type: 'Left', value: err }),
      val => ({ type: 'Right', value: val })
    );
    assert.deepStrictEqual(result, { type: 'Left', value: 'Value was null' });
  });

  test('Right(5).map(x => x * 2) should be Right(10)', () => {
    const result = Either.of(5)
      .map(x => x * 2)
      .fold(
        err => ({ type: 'Left', value: err }),
        val => ({ type: 'Right', value: val })
      );
    assert.deepStrictEqual(result, { type: 'Right', value: 10 });
  });

  test('Left propagates through map — value is unchanged', () => {
    const result = Either.fromNullable(null, 'Not found')
      .map(x => x * 2)
      .fold(
        err => ({ type: 'Left', value: err }),
        val => ({ type: 'Right', value: val })
      );
    assert.deepStrictEqual(result, { type: 'Left', value: 'Not found' });
  });

  test('Right.chain sequences operations', () => {
    const result = Either.of(5)
      .chain(x => Either.of(x * 2))
      .fold(
        err => ({ type: 'Left', value: err }),
        val => ({ type: 'Right', value: val })
      );
    assert.deepStrictEqual(result, { type: 'Right', value: 10 });
  });

  test('Left.chain propagates the error', () => {
    const result = Either.fromNullable(null, 'Error')
      .chain(x => Either.of(x * 2))
      .fold(
        err => ({ type: 'Left', value: err }),
        val => ({ type: 'Right', value: val })
      );
    assert.deepStrictEqual(result, { type: 'Left', value: 'Error' });
  });

  test('Right.filter produces Left when predicate fails', () => {
    const result = Either.of(5)
      .filter(x => x > 10, 'Number too small')
      .fold(err => err, val => val);
    assert.strictEqual(result, 'Number too small');
  });

  test('fold calls the right function for Right', () => {
    const result = Either.of(5).fold(
      x => `Left: ${x}`,
      x => `Right: ${x}`
    );
    assert.strictEqual(result, 'Right: 5');
  });

  test('fold calls the left function for Left', () => {
    const result = Either.fromNullable(null, 'Error').fold(
      x => `Left: ${x}`,
      x => `Right: ${x}`
    );
    assert.strictEqual(result, 'Left: Error');
  });
});
```

The fold pattern in the first several tests wraps the result in `{ type, value }`. This serves a specific purpose: it lets a single `deepStrictEqual` assertion check both which track we're on (Left or Right) and what value we have. If a test expects `Right(10)` and gets `Left('error')`, the assertion shows you both — the type and value mismatch.

For simpler tests like the `filter` and `fold` tests at the end, you can fold directly to a plain value when you're only checking one track.

## The First Two Tests Cover Two Things

There's a subtle point about the `Either.of` and `fold` tests. The very first test:

```js
test('Either.of(5) should be Right(5)', () => {
  const result = Either.of(5).fold(...);
  assert.deepStrictEqual(result, { type: 'Right', value: 5 });
});
```

This tests two things: that `Either.of` creates a `Right`, and that `fold` correctly calls the right function for a `Right`. You could separate them — one test for `Either.of`, one for `fold` — but they're so interdependent that separating them doesn't gain much. If `Either.of` produces the wrong type, any `fold` test will catch it. The important thing is that the tests exist and are precise.

## Tests as Formal Specifications

Look at what the Either tests collectively document:

- `Either.of` produces Right
- `fromNullable` with null produces Left with a default message
- `fromNullable` with a custom message uses that message
- `map` transforms Right values
- `map` passes Left values through unchanged
- `chain` sequences Right operations
- `chain` passes Left values through unchanged
- `filter` can convert Right to Left when the predicate fails
- `fold` calls the appropriate function for each case

That's a complete behavioural specification of Either. If you handed someone this test file and asked them to implement `Either` from scratch, they could do it correctly without reading the implementation. That's what good tests look like.

## The Monad Laws, Made Testable

Chapter five mentioned the monad laws informally. Let's make them concrete with tests.

**Left identity**: `Maybe.of(x).chain(f)` should equal `f(x)`.

```js
test('left identity: Maybe.of(x).chain(f) === f(x)', () => {
  const f = x => Maybe.of(x * 2);
  const left  = Maybe.of(5).chain(f).getOrElse(null);
  const right = f(5).getOrElse(null);
  assert.strictEqual(left, right);
});
```

**Right identity**: `m.chain(Maybe.of)` should equal `m`.

```js
test('right identity: m.chain(Maybe.of) === m', () => {
  const m = Maybe.of(5);
  const result = m.chain(Maybe.of).getOrElse(null);
  assert.strictEqual(result, m.getOrElse(null));
});
```

These aren't tests you need in your test suite to ship working software. But writing them cements your understanding of why the types behave consistently. If these laws hold — and they do, by construction — you know the types will compose predictably in any combination.

## Running the Full Suite

With the test files in place:

```
npm test
```

You'll see grouped output from each `describe` block. A well-organized test suite with clear names reads like documentation when everything passes. When something fails, the failure message — the test name plus the assertion error — tells you exactly what contract was broken and what the actual versus expected values were.

```
▶ Maybe
  ✓ Maybe.of creates a Just value
  ✓ Maybe.nothing creates a Nothing value
  ✓ Maybe.map applies a function to a Just value
  ✓ Maybe.map does not apply a function to Nothing
  ✓ Maybe.chain allows chaining operations that return Maybe
  ✓ Maybe.chain short-circuits if any operation returns Nothing
▶ Either
  ✓ Either.of(5) should be Right(5)
  ...
```

Nine files, zero mocks, zero dependencies beyond the standard library.

## A Few Things to Sit With

Before the final chapter:

- We've tested all the way through from a test-after perspective — implement, then test. Would anything be different if you'd written the tests first? For which functions would that be natural? For which would it feel forced?
- `Task` isn't covered in the test suite yet. How would you test `Task.of(5).map(x => x * 2)`? Task's fork is a callback — how do you assert on a value that arrives asynchronously in a `node:test` test?
- The tests document the current behaviour. If you change `normalizeItem` to use a different field name for the error key — say `message` instead of `error` — several tests would fail. Is that good or bad? Is test failure on interface changes the right behaviour?

Chapter thirteen is the last in the series. It steps back from the mechanics and examines when TDD makes sense in a functional codebase, what the discipline actually looks like in practice, and what "good test coverage" means for code structured the way ours is.
