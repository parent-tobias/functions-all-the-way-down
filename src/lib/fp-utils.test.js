import { test, describe } from 'node:test';
import assert from 'assert/strict';
import { anyPass, firstOf, when } from './fp-utils.js';

describe('anyPass', () => {
  test('returns true if any predicate passes', () => {
    const isEven = x => x % 2 === 0;
    const isGreaterThan10 = x => x > 10;
    const isEvenOrGreater = anyPass(isEven, isGreaterThan10);

    assert.strictEqual(isEvenOrGreater(4), true);
    assert.strictEqual(isEvenOrGreater(11), true);
    assert.strictEqual(isEvenOrGreater(3), false);
  });

  test('returns false if all predicates fail', () => {
    const isEven = x => x % 2 === 0;
    const isGreaterThan10 = x => x > 10;
    const isEvenOrGreater = anyPass(isEven, isGreaterThan10);

    assert.strictEqual(isEvenOrGreater(3), false);
    assert.strictEqual(isEvenOrGreater(9), false);
  });

  test('returns false with no predicates', () => {
    assert.strictEqual(anyPass()(3), false);
  });
});

describe('firstOf', () => {
  test('returns the first non-null value', () => {
    const obj = { a: null, b: 'value', c: 'other' };
    assert.strictEqual(firstOf('a', 'b', 'c')(obj), 'value');
  });

  test('returns undefined if all values are null or undefined', () => {
    const obj = { a: null, b: undefined };
    assert.strictEqual(firstOf('a', 'b')(obj), undefined);
  });

  test('returns 0 — a falsy-but-valid value', () => {
    const obj = { a: 0, b: 'fallback' };
    assert.strictEqual(firstOf('a', 'b')(obj), 0);
  });
});

describe('when', () => {
  test('applies the function if condition is truthy', () => {
    const addOne = x => x + 1;
    assert.strictEqual(when(true, addOne)(5), 6);
  });

  test('passes the value through unchanged if condition is falsy', () => {
    const addOne = x => x + 1;
    assert.strictEqual(when(false, addOne)(5), 5);
  });
});
