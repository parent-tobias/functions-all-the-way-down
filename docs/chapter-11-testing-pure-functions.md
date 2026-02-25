# Functions All the Way Down: Chapter 11
## Testing Pure Functions — The Payoff

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

Here's the central claim of the last ten chapters: pure functions are easy to test.

Not "easier than stateful objects." Not "easier once you've set things up." *Easy.* A pure function test has three parts: a plain input, a function call, and an assertion about the output. No database to seed, no server to start, no mocks to configure, no teardown to clean up. If the function takes an array and returns an array, you pass in an array and assert on what comes back.

This chapter makes that concrete. We'll walk through the actual test suite for `normalizeItem` and `fp-utils`, examine how `node:test` works, and look at what good pure function tests look like. By the end, you'll see why testing is the *last* chapter in the implementation sequence but the *first* reason to structure your code this way.

## Node's Built-In Test Runner

Since Node 18, there's been a built-in test runner: `node:test`. No installation required. No configuration files. No test framework opinions. You import `test` and `describe`, write your tests, and run them with `node --test`.

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
```

`test` defines a single test case. `describe` groups related tests. `assert` from `node:assert/strict` provides the assertions — and importing from `node:assert/strict` means all assertions use strict equality by default, which is almost always what you want.

Run your tests:

```
node --test src/transforms.test.js src/lib/fp-utils.test.js
```

You'll see output that reports pass/fail for each test, with the test name and any assertion failures. Add it to `package.json`:

```json
{
  "scripts": {
    "test": "node --test src/*.test.js src/lib/*.test.js"
  }
}
```

Then `npm test` runs everything. Note the explicit paths — bash's glob expansion doesn't handle `**` without the `globstar` shell option, so listing the directories explicitly is the safe approach.

## Testing `normalizeItem`

`normalizeItem` is the most interesting function to test because it has multiple failure modes. Each one should be covered.

```js
// src/transforms.test.js
import { test } from 'node:test';
import assert from 'assert';
import { normalizeItem } from './transforms.js';

test('normalizeItem should return valid normalized item', () => {
  const input = {
    title: 'Test Item',
    link: 'http://example.com/test-item',
    description: 'This is a test item.',
    author: 'Test author',
    categories: ['Test', 'Example'],
    pubDate: '2024-01-01T00:00:00Z',
  };

  const result = normalizeItem(input);

  assert.equal(result.valid, true);
  assert.deepEqual(result.data, {
    title: 'Test Item',
    link: 'http://example.com/test-item',
    summary: 'This is a test item.',
    author: 'Test author',
    categories: ['Test', 'Example'],
    pubDate: '2024-01-01T00:00:00Z',
  });
});
```

Two assertions: `result.valid` and `result.data`. `assert.equal` for the boolean (strict value comparison), `assert.deepEqual` for the object (deep structural comparison). Both are necessary — the shape of the result object is part of `normalizeItem`'s contract.

Now the failure cases:

```js
test('normalizeItem should return error for null item', () => {
  const result = normalizeItem(null);
  assert.equal(result.valid, false);
  assert.equal(result.error, 'Item was null');
});

test('normalizeItem should return an error for a missing title', () => {
  const result = normalizeItem({});
  assert.equal(result.valid, false);
  assert.equal(result.error, 'Title was null');
});

test('normalizeItem should return an error for a missing link', () => {
  const result = normalizeItem({ title: 'Test Item' });
  assert.equal(result.valid, false);
  assert.equal(result.error, 'Link was null');
});
```

Each test targets one specific failure. The error message tested against — `'Item was null'`, `'Title was null'`, `'Link was null'` — is the exact string from the Either's `fromNullable` call in `normalizeItem`. If the error message ever changes, the test breaks, which means you'd need to update both deliberately.

Finally, the edge case where required fields are present but optional ones aren't:

```js
test('normalizeItem should handle missing description and author', () => {
  const input = {
    title: 'Test Item',
    link: 'http://example.com/test-item',
    pubDate: '2024-01-01T00:00:00Z',
  };

  const result = normalizeItem(input);

  assert.equal(result.valid, true);
  assert.equal(result.data.summary, 'No description available');
  assert.equal(result.data.author, 'Unknown Author');
});
```

This test documents the defaults. It confirms that `normalizeItem` produces a valid result even without optional fields, and specifies exactly what the defaults are.

Five tests. No server. No network. No mocks. You run them with `node --test` and they either pass or they tell you exactly what's wrong.

## `assert.equal` vs `assert.deepEqual` vs `assert.strictEqual`

When to use each:

- **`assert.equal(a, b)`** — uses `==` under the hood. Fine for primitives where you want loose equality. In practice, `assert.strictEqual` is usually better.
- **`assert.strictEqual(a, b)`** — uses `===`. This is what you want for strings, numbers, booleans. Does not work for objects (`{} !== {}` in JavaScript).
- **`assert.deepEqual(a, b)`** — recursively compares structure. Use this for objects and arrays where you're comparing contents, not identity.

When in doubt: use `strictEqual` for primitives, `deepEqual` for objects. Using `assert/strict` instead of `assert` makes `equal` behave like `strictEqual` — which is why the import path matters.

## Testing `fp-utils` with `describe`

`describe` groups related tests under a heading. The output groups passing/failing tests by the label you provide, which makes it easier to understand which area of code is broken when tests fail.

```js
// src/lib/fp-utils.test.js
import { test, describe } from 'node:test';
import assert from 'assert/strict';
import { anyPass, firstOf, when } from './fp-utils.js';

describe('anyPass', () => {
  test('returns true if any predicate passes', () => {
    const isEven = x => x % 2 === 0;
    const isGreaterThan10 = x => x > 10;
    const isEvenOrGreater = anyPass(isEven, isGreaterThan10);

    assert.strictEqual(isEvenOrGreater(4), true);   // even
    assert.strictEqual(isEvenOrGreater(11), true);  // greater than 10
    assert.strictEqual(isEvenOrGreater(3), false);  // neither
  });

  test('returns false with no predicates', () => {
    const alwaysFalse = anyPass();
    assert.strictEqual(alwaysFalse(3), false);
  });
});

describe('firstOf', () => {
  test('returns the first non-null value', () => {
    const obj = { a: null, b: 'value', c: 'other' };
    assert.strictEqual(firstOf('a', 'b', 'c')(obj), 'value');
  });

  test('returns 0 if that is the first non-null value', () => {
    const obj = { a: 0, b: 'fallback' };
    assert.strictEqual(firstOf('a', 'b')(obj), 0);
  });
});

describe('when', () => {
  test('applies the function if condition is truthy', () => {
    const addOne = x => x + 1;
    assert.strictEqual(when(true, addOne)(5), 6);
  });

  test('returns value unchanged if condition is falsy', () => {
    const addOne = x => x + 1;
    assert.strictEqual(when(false, addOne)(5), 5);
  });
});
```

The `firstOf` test for `0` is worth examining. `0` is falsy in JavaScript. If `firstOf` used `v` instead of `v != null` to check for presence, it would skip `0` and return `'fallback'` — wrong. The test catches that behaviour explicitly. This is the kind of edge case that pure function tests are good at documenting: you construct an input that triggers the edge case and assert on the correct behaviour.

## Tests as Specification

Look at the test names across the entire test suite:

- `normalizeItem should return valid normalized item`
- `normalizeItem should return error for null item`
- `anyPass returns true if any predicate passes`
- `when applies the function if condition is truthy`

These read like a specification. If you had no code and only these test names, you could reconstruct a reasonable understanding of what each function does. When tests fail, the names tell you what contract was broken.

This is why naming tests clearly matters. `test('works correctly')` tells you nothing. `test('normalizeItem returns valid:false when title is null')` tells you the function, the condition, and the expected behaviour.

## What You Don't Need

It's worth being explicit about what's absent from this test file:

- No `beforeEach` / `afterEach` hooks to set up or tear down state
- No mock libraries to fake network calls
- No test database to configure
- No HTTP client to make requests

Every test runs independently and leaves no trace. They could run in any order and the results would be the same. That's the payoff of keeping business logic in pure functions — the tests are as simple as the functions themselves.

## A Few Things to Sit With

Before chapter twelve:

- `normalizeItem` uses Either internally. You tested it by looking at the `valid`/`data`/`error` result shape — you never dealt with Either directly in the test. Is that the right level to test at? Or would it be useful to test the Either-handling behaviour separately?
- Maybe and Either have their own behaviour that's independent of `normalizeItem`. If `Maybe.map` on a `Nothing` returned the wrong thing, `normalizeItem` tests might still pass. Is there value in having separate tests for the algebraic types themselves?
- The tests we wrote are *example-based* — we provide specific inputs and check specific outputs. Is there a more powerful approach that could verify behaviour across a wider range of inputs without writing each case by hand?

Chapter twelve tests the algebraic types directly — Maybe, Either, and `fp-utils` — and addresses how to extract values from containers to make meaningful assertions.
