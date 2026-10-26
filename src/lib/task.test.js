import { test, describe } from 'node:test';
import assert from 'assert';
import { Task, delays, isTimeoutError } from './task.js';

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
describe('Task hardening (chapter 21)', () => {
	const runTask = task => new Promise((resolve, reject) =>
		task.fork(reject, resolve));
	const runTaskErr = task => new Promise((resolve, reject) =>
		task.fork(resolve, () => reject(new Error('Expected the Task to reject'))));

	test('fork settles exactly once, however the executor behaves', async () => {
		let calls = 0;
		const task = Task((reject, resolve) => {
			resolve('first');
			reject(new Error('second'));
			resolve('third');
		});
		const value = await new Promise((resolve, reject) =>
			task.fork(
				err => { calls += 1; reject(err); },
				x   => { calls += 1; resolve(x); }
			));
		assert.equal(value, 'first');
		assert.equal(calls, 1);
	});

	test('an executor that throws rejects — once', async () => {
		const err = await runTaskErr(Task(() => { throw new Error('boom'); }));
		assert.equal(err.message, 'boom');
	});

	test('Task.all settles exactly once when several tasks fail', async () => {
		let calls = 0;
		const all = Task.all([Task.rejected('one'), Task.rejected('two'), Task.of(3)]);
		const err = await new Promise(resolve =>
			all.fork(
				e => { calls += 1; resolve(e); },
				() => { calls += 1; resolve(null); }
			));
		assert.equal(err, 'one');
		assert.equal(calls, 1);
	});

	test('Task.all([]) resolves immediately with an empty array', async () => {
		assert.deepEqual(await runTask(Task.all([])), []);
	});

	test('timeout rejects a Task that never settles, with the shaped 504', async () => {
		const err = await runTaskErr(Task(() => {}).timeout(25));
		assert.equal(err.status, 504);
		assert.equal(isTimeoutError(err), true);
		assert.match(err.message, /Timed out after 25 ms/);
	});

	test('timeout passes a Task that settles in time', async () => {
		assert.equal(await runTask(Task.of(42).timeout(1000)), 42);
	});

	test('a late settlement after the deadline is ignored', async () => {
		let resolved = 0;
		const slow = Task((reject, resolve) =>
			setTimeout(() => resolve('late'), 60));
		const err = await new Promise(resolve =>
			slow.timeout(15).fork(resolve, () => { resolved += 1; resolve(null); }));
		assert.equal(err.status, 504);
		await new Promise(r => setTimeout(r, 90));
		assert.equal(resolved, 0);
	});

	test('delays is a pure exponential schedule', () => {
		assert.deepEqual(delays(0, 100), []);
		assert.deepEqual(delays(1, 100), [100]);
		assert.deepEqual(delays(4, 100), [100, 200, 400, 800]);
		assert.deepEqual(delays(3, 50), [50, 100, 200]);
	});

	test('retry re-runs the Task until it succeeds', async () => {
		let attempts = 0;
		const flaky = Task((reject, resolve) => {
			attempts += 1;
			attempts < 3 ? reject(new Error(`fail ${attempts}`)) : resolve('ok');
		});
		assert.equal(await runTask(flaky.retry(2, 5)), 'ok');
		assert.equal(attempts, 3);
	});

	test('retry exhausts honestly and rejects with the last error', async () => {
		let attempts = 0;
		const hopeless = Task(reject => {
			attempts += 1;
			reject(new Error(`fail ${attempts}`));
		});
		const err = await runTaskErr(hopeless.retry(2, 5));
		assert.equal(err.message, 'fail 3');
		assert.equal(attempts, 3);
	});

	test('retry(0) is a single attempt', async () => {
		let attempts = 0;
		const once = Task(reject => { attempts += 1; reject(new Error('nope')); });
		const err = await runTaskErr(once.retry(0, 5));
		assert.equal(err.message, 'nope');
		assert.equal(attempts, 1);
	});
});
