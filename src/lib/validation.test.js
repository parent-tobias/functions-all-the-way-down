import { test, describe } from 'node:test';
import assert from 'assert';
import { Validation, Success, Failure } from './validation.js';

describe('validate', () => {
  test('creates a Success with Validation.of', () => {
		const result = Validation.of(42);
		result.fold(
			err => assert.fail(`Unexpected failure: ${err}`),
			value => assert.equal(value, 42)
		);
	});

	test('creates a Failure with Validation.Failure', () => {
		const result = Validation.Failure(['error']);
		result.fold(
			err => assert.deepEqual(err, ['error']),
			value => assert.fail(`Unexpected success: ${value}`)
		);
	});
	test('maps values in Success', () => {
		const result = Success(2).map(x => x * 3);
		result.fold(
			err => assert.fail(`Unexpected failure: ${err}`),
			value => assert.equal(value, 6)
		);
	});
	test('maps errors in Failure', () => {
		const result = Failure(['bad']).map(x => x * 3);
		result.fold(
			err => assert.deepEqual(err, ['bad']),
			value => assert.fail(`Unexpected success: ${value}`)
		);
	});
	test('applies functions in Success', () => {
		const result = Success(x => x * 3).ap(Success(2));
		result.fold(
			err => assert.fail(`Unexpected failure: ${err}`),
			value => assert.equal(value, 6)
		);
	});
	test('combines errors in Failure', () => {
		const result = Failure(['bad1']).ap(Failure(['bad2']));
		result.fold(
			err => assert.deepEqual(err, ['bad1', 'bad2']),
			value => assert.fail(`Unexpected success: ${value}`)
		);
	});
	test('going from a Success to an .ap(failure) should produce a Failure', () => {
		const result = Success(42).ap(Failure(['error']));
		result.fold(
			err => assert.deepEqual(err, ['error']),
			value => assert.fail(`Unexpected success: ${value}`)
		);
	});
	test('going from a Failure to an .ap(success) should produce a Failure', () => {
		const result = Failure(['error']).ap(Success(42));
		result.fold(
			err => assert.deepEqual(err, ['error']),
			value => assert.fail(`Unexpected success: ${value}`)
		);
	});
	test('multiple .ap calls should combine all errors', () => {
		const result = Success(x => y => x + y)
			.ap(Failure(['error1']))
			.ap(Failure(['error2']));
		result.fold(
			err => assert.deepEqual(err, ['error1', 'error2']),
			value => assert.fail(`Unexpected success: ${value}`)
		);
	});
});