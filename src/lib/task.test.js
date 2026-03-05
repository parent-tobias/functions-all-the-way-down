import { test, describe } from 'node:test';
import assert from 'assert';
import { Task } from './task.js';

describe('Task', () => {
	test('creates a Task with Task.of', () => {
		const task = Task.of(42);
		task.fork(
			err => assert.fail(err),
			value => assert.equal(value, 42)
		);
	});
	test('creates a rejected Task with Task.rejected', () => {
		const task = Task.rejected('error');
		task.fork(
			err => assert.equal(err, 'error'),
			value => assert.fail(`Unexpected success: ${value}`)
		);
	});
	test('maps values', () => {
		const task = Task.of(2).map(x => x * 3);
		task.fork(
			err => assert.fail(err),
			value => assert.equal(value, 6)
		);
	});
	test('maps errors', () => {
		const task = Task.rejected('bad').mapError(err => `Error: ${err}`);
		task.fork(
			err => assert.equal(err, 'Error: bad'),
			value => assert.fail(`Unexpected success: ${value}`)
		);
	});
	test('mapError does not affect a resolved Task', () => {
		const task = Task.of(42).mapError(err => `Error: ${err}`);
		task.fork(
			err    => assert.fail(`Unexpected error: ${err}`),
			value  => assert.equal(value, 42)
		);
	});
	test('chains tasks', () => {
		const task = Task.of(2).chain(x => Task.of(x * 3));
		task.fork(
			err => assert.fail(err),
			value => assert.equal(value, 6)
		);
	});
	test('runs tasks concurrently with Task.all', () => {
		const task1 = Task.of(1);
		const task2 = Task.of(2);
		const task3 = Task.of(3);
		const allTask = Task.all([task1, task2, task3]);
		allTask.fork(
			err => assert.fail(err),
			values => assert.deepEqual(values, [1, 2, 3])
		);
	});
	test('Task.all fails fast on rejection', () => {
		const task1 = Task.of(1);
		const task2 = Task.rejected('error');
		const task3 = Task.of(3);
		const allTask = Task.all([task1, task2, task3]);
		allTask.fork(
			err => assert.equal(err, 'error'),
			values => assert.fail(`Unexpected success: ${values}`)
		);
	});
	test('preserves order in Task.all', () => {
		const task1 = Task.of(1);
		const task2 = Task.of(2);
		const task3 = Task.of(3);
		const allTask = Task.all([task3, task1, task2]);
		allTask.fork(
			err => assert.fail(err),
			values => assert.deepEqual(values, [3, 1, 2])
		);
	});
	test('folds tasks', () => {
		const task = Task.of(2).fold(
			err => `Error: ${err}`,
			value => `Value: ${value}`
		);
		task.fork(
			err => assert.fail(err),
			result => assert.equal(result, 'Value: 2')
		);
	});
	test('folds rejected tasks', () => {
		const task = Task.rejected('bad').fold(
			err => `Error: ${err}`,
			value => `Value: ${value}`
		);
		task.fork(
			err => assert.fail(err),
			result => assert.equal(result, 'Error: bad')
		);
	});
	test('maps errors in chained tasks', () => {
		const task = Task.of(2)
			.chain(x => Task.rejected('bad'))
			.mapError(err => `Error: ${err}`);
		task.fork(
			err => assert.equal(err, 'Error: bad'),
			value => assert.fail(`Unexpected success: ${value}`)
		);
	});
	test('maps errors in Task.all', () => {
		const task1 = Task.of(1);
		const task2 = Task.rejected('error').mapError(err => `Error: ${err}`);
		const task3 = Task.of(3);
		const allTask = Task.all([task1, task2, task3]);
		allTask.fork(
			err => assert.equal(err, 'Error: error'),
			values => assert.fail(`Unexpected success: ${values}`)
		);
	});
	test('maps errors in folded Task.all', () => {
		const task1 = Task.of(1);
		const task2 = Task.rejected('error').mapError(err => `Error: ${err}`);
		const task3 = Task.of(3);
		const allTask = Task.all([task1, task2, task3]).fold(
			err => `Folded error: ${err}`,
			values => `Folded values: ${values}`
		);
		allTask.fork(
			err => assert.fail(err),
			result => assert.equal(result, 'Folded error: Error: error')
		);
	});
	test('maps values in folded Task.all', () => {
		const task1 = Task.of(1);
		const task2 = Task.of(2);
		const task3 = Task.of(3);
		const allTask = Task.all([task1, task2, task3]).fold(
			err => `Folded error: ${err}`,
			values => `Folded values: ${values}`
		);
		allTask.fork(
			err => assert.fail(err),
			result => assert.equal(result, 'Folded values: 1,2,3')
		);
	});
});	