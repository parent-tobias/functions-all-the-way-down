import { test, describe } from 'node:test';
import assert from 'assert';
import { Either } from './either.js';

describe('Either', () => {
  test('Either.of(5) should be Right(5)', () => {
    const result = Either.of(5).fold(
      err => ({ type: 'Left',  value: err }),
      val => ({ type: 'Right', value: val })
    );
    assert.deepStrictEqual(result, { type: 'Right', value: 5 });
  });

  test('Either.fromNullable(null) should be Left("Value was null")', () => {
    const result = Either.fromNullable(null).fold(
      err => ({ type: 'Left',  value: err }),
      val => ({ type: 'Right', value: val })
    );
    assert.deepStrictEqual(result, { type: 'Left', value: 'Value was null' });
  });

  test('Right(5).map(x => x * 2) should be Right(10)', () => {
    const result = Either.of(5).map(x => x * 2).fold(
      err => ({ type: 'Left',  value: err }),
      val => ({ type: 'Right', value: val })
    );
    assert.deepStrictEqual(result, { type: 'Right', value: 10 });
  });

  test('Left("Not found").map(...) should be Left("Not found")', () => {
    const result = Either.fromNullable(null, 'Not found').map(x => x * 2).fold(
      err => ({ type: 'Left',  value: err }),
      val => ({ type: 'Right', value: val })
    );
    assert.deepStrictEqual(result, { type: 'Left', value: 'Not found' });
  });

  test('Right(5).chain(x => Right(x * 2)) should be Right(10)', () => {
    const result = Either.of(5).chain(x => Either.of(x * 2)).fold(
      err => ({ type: 'Left',  value: err }),
      val => ({ type: 'Right', value: val })
    );
    assert.deepStrictEqual(result, { type: 'Right', value: 10 });
  });

  test('Left("Error").chain(...) should be Left("Error")', () => {
    const result = Either.fromNullable(null, 'Error').chain(x => Either.of(x * 2)).fold(
      err => ({ type: 'Left',  value: err }),
      val => ({ type: 'Right', value: val })
    );
    assert.deepStrictEqual(result, { type: 'Left', value: 'Error' });
  });

  test('Right(5).filter(x => x > 10, msg) should be Left(msg)', () => {
    const result = Either.of(5)
      .filter(x => x > 10, 'Number too small')
      .fold(err => err, val => val);
    assert.strictEqual(result, 'Number too small');
  });

  test('Right(5).fold calls the right function', () => {
    const result = Either.of(5).fold(x => `Left: ${x}`, x => `Right: ${x}`);
    assert.strictEqual(result, 'Right: 5');
  });

  test('Left("Error").fold calls the left function', () => {
    const result = Either.fromNullable(null, 'Error').fold(x => `Left: ${x}`, x => `Right: ${x}`);
    assert.strictEqual(result, 'Left: Error');
  });
});
