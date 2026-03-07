// /src/lib/io.test.js
//
// Tests for the IO monad.
import { describe, test } from 'node:test';
import assert from 'assert';
import { IO } from './io.js';

describe('IO', () => {
	test('creates an IO with IO.of', () => {
		const io = IO.of(42);
		assert.equal(io.run(), 42);
	});
	test('reads from the environment on run', () => {
		process.env.TEST_PORT = '4000';
		const io = IO(() => process.env.TEST_PORT).map(p => parseInt(p, 10));
		assert.equal(io.run(), 4000);
		delete process.env.TEST_PORT;
	});
	test('maps values', () => {
		const io = IO.of(2).map(x => x * 3);
		assert.equal(io.run(), 6);
	});
	test('chains computations', () => {
		const io = IO.of(2).chain(x => IO.of(x * 3));
		assert.equal(io.run(), 6);
	});
	test('is lazy and does not execute until run is called', () => {
		let sideEffect = false;
		const io = IO(() => { sideEffect = true; return 42; });
		assert.equal(sideEffect, false);
		assert.equal(io.run(), 42);
		assert.equal(sideEffect, true);
	});
});