import { test, describe } from 'node:test';
import assert from 'assert';
import { Maybe } from './maybe.js';

describe('Maybe', () => {
  test('Maybe.of creates a Just value', () => {
    const maybeValue = Maybe.of(5);
    assert.strictEqual(maybeValue.inspect().includes('Just'), true);
    assert.strictEqual(maybeValue.getOrElse(null), 5);
  });

  test('Maybe.nothing creates a Nothing value', () => {
    const maybeValue = Maybe.nothing();
    assert.strictEqual(maybeValue.getOrElse('nothing there'), 'nothing there');
  });

  test('Maybe.getOrElse returns the value if it is Just', () => {
    assert.strictEqual(Maybe.of(5).getOrElse(10), 5);
  });

  test('Maybe.map applies a function to a Just value', () => {
    const result = Maybe.of(5).map(x => x * 2);
    assert.strictEqual(result.inspect().includes('Just'), true);
    assert.strictEqual(result.getOrElse(null), 10);
  });

  test('Maybe.map does not apply a function to Nothing', () => {
    const result = Maybe.nothing().map(x => x * 2);
    assert.strictEqual(result.getOrElse('nothing there'), 'nothing there');
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

  test('Maybe.getOrElse returns the default value if it is Nothing', () => {
    assert.strictEqual(Maybe.nothing().getOrElse(10), 10);
  });
});
