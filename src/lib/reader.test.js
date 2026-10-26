// src/lib/reader.test.js
import { test, describe } from 'node:test';
import assert from 'assert';
import { Reader, ReaderTask } from './reader.js';
import { Task } from './task.js';

// ReaderTasks are lazy like everything else; fork one and await it.
const runTask = task => new Promise((resolve, reject) =>
  task.fork(reject, resolve));
const runTaskErr = task => new Promise((resolve, reject) =>
  task.fork(resolve, () => reject(new Error('Expected the Task to reject'))));

const env = { greeting: 'Hello', name: 'World' };

describe('Reader', () => {
  test('runReader supplies the environment', () => {
    const reader = Reader(e => e.greeting);
    assert.equal(reader.runReader(env), 'Hello');
  });

  test('Reader.of ignores the environment', () => {
    assert.equal(Reader.of(42).runReader(env), 42);
    assert.equal(Reader.of(42).runReader({}), 42);
  });

  test('map transforms the result, not the environment', () => {
    const reader = Reader(e => e.greeting).map(s => `${s}!`);
    assert.equal(reader.runReader(env), 'Hello!');
  });

  test('chain sequences two environment-dependent computations', () => {
    const reader = Reader(e => e.greeting)
      .chain(greeting => Reader(e => `${greeting}, ${e.name}`));
    assert.equal(reader.runReader(env), 'Hello, World');
  });

  test('ask returns the whole environment', () => {
    assert.deepEqual(Reader.ask.runReader(env), env);
  });

  test('asks projects a value out of the environment', () => {
    assert.equal(Reader.asks(e => e.name).runReader(env), 'World');
  });

  test('the same Reader runs against different environments', () => {
    const reader = Reader.asks(e => `${e.greeting}, ${e.name}`);
    assert.equal(reader.runReader(env), 'Hello, World');
    assert.equal(reader.runReader({ greeting: 'Hi', name: 'Reader' }), 'Hi, Reader');
  });
});

describe('ReaderTask', () => {
  test('runReader supplies the env and returns a Task', async () => {
    const rt = ReaderTask(e => Task.of(e.greeting));
    assert.equal(await runTask(rt.runReader(env)), 'Hello');
  });

  test('ReaderTask.of resolves without touching the environment', async () => {
    assert.equal(await runTask(ReaderTask.of(7).runReader({})), 7);
  });

  test('map transforms the resolved value', async () => {
    const rt = ReaderTask.asks(e => e.name).map(name => name.toUpperCase());
    assert.equal(await runTask(rt.runReader(env)), 'WORLD');
  });

  test('chain threads the same env through both steps', async () => {
    const rt = ReaderTask.asks(e => e.greeting)
      .chain(greeting => ReaderTask.asks(e => `${greeting}, ${e.name}`));
    assert.equal(await runTask(rt.runReader(env)), 'Hello, World');
  });

  test('mapError transforms the rejection', async () => {
    const rt = ReaderTask(() => Task.rejected(new Error('boom')))
      .mapError(err => ({ status: 500, message: err.message }));
    const err = await runTaskErr(rt.runReader(env));
    assert.deepEqual(err, { status: 500, message: 'boom' });
  });

  test('fromTask lifts a plain Task', async () => {
    const rt = ReaderTask.fromTask(Task.of('lifted'));
    assert.equal(await runTask(rt.runReader(env)), 'lifted');
  });

  test('fromReader lifts a plain Reader', async () => {
    const rt = ReaderTask.fromReader(Reader.asks(e => e.name));
    assert.equal(await runTask(rt.runReader(env)), 'World');
  });

  test('ask and asks read the environment', async () => {
    assert.deepEqual(await runTask(ReaderTask.ask.runReader(env)), env);
    assert.equal(await runTask(ReaderTask.asks(e => e.greeting).runReader(env)), 'Hello');
  });
});
