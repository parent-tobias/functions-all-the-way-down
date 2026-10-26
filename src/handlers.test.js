// src/handlers.test.js
//
// The testing payoff of chapter 20: the handlers are ReaderTasks, so a
// test supplies a fake environment — an in-memory store with the same
// interface, a silent logger — and forks the result. No database, no
// HTTP, no mocking framework. Swap the env, not the code.
import { test, describe } from 'node:test';
import assert from 'assert';
import { EventEmitter } from 'node:events';
import { Task } from './lib/task.js';
import { IO } from './lib/io.js';
import {
  handleFeedRequest,
  handleSaveFeedRequest,
  handleSavedFeedsRequest,
  handleHealthRequest,
} from './server.js';

const runTask = task => new Promise((resolve, reject) =>
  task.fork(reject, resolve));
const runTaskErr = task => new Promise((resolve, reject) =>
  task.fork(resolve, () => reject(new Error('Expected the Task to reject'))));

// A logger that describes nothing and prints nothing.
const silentLogger = {
  debug: () => IO.of(null),
  info:  () => IO.of(null),
  warn:  () => IO.of(null),
  error: () => IO.of(null),
};

// An in-memory store with the same interface as src/store.js,
// plus a record of what it was asked to save.
const makeFakeStore = (saved = []) => {
  const feeds = [...saved];
  const calls = [];
  return {
    calls,
    saveFeed: feed => {
      calls.push(feed);
      if (feeds.some(f => f.url === feed.url)) {
        return Task.rejected({ status: 409, message: `Feed already saved: ${feed.url}` });
      }
      const record = { id: feeds.length + 1, ...feed, createdAt: '2026-01-01 00:00:00' };
      feeds.push(record);
      return Task.of(record);
    },
    loadFeeds: () => Task.of([...feeds]),
    ping: () => Task.of(feeds.length),
    close: () => {},
  };
};

const fakeEnv = (store = makeFakeStore()) => ({
  config: { port: 3000, feedsDb: ':memory:', logLevel: 'error', feedTimeoutMs: 1000, feedRetries: 0 },
  store,
  logger: silentLogger,
});

// The smallest req that readBody can read: an emitter that produces
// one chunk and ends, on the next tick (after the handler subscribes).
const fakeReq = body => {
  const req = new EventEmitter();
  req.method = 'POST';
  req.url = '/feeds';
  process.nextTick(() => {
    req.emit('data', Buffer.from(JSON.stringify(body)));
    req.emit('end');
  });
  return req;
};

describe('handleSaveFeedRequest against a fake env', () => {
  test('saves a valid feed and resolves 201 with the record', async () => {
    const store = makeFakeStore();
    const result = await runTask(
      handleSaveFeedRequest(fakeReq({ url: 'https://example.com/rss.xml', title: 'Example' }))
        .runReader(fakeEnv(store))
    );
    assert.equal(result.status, 201);
    assert.equal(result.body.url, 'https://example.com/rss.xml');
    assert.equal(result.body.title, 'Example');
    // The handler really did hand the validated feed to the env's store.
    assert.deepEqual(store.calls, [{ url: 'https://example.com/rss.xml', title: 'Example' }]);
  });

  test('a duplicate save rejects with the store’s 409 shape, untouched', async () => {
    const store = makeFakeStore([{ id: 1, url: 'https://example.com/rss.xml', title: 'Example', createdAt: '2026-01-01 00:00:00' }]);
    const err = await runTaskErr(
      handleSaveFeedRequest(fakeReq({ url: 'https://example.com/rss.xml' }))
        .runReader(fakeEnv(store))
    );
    assert.deepEqual(err, { status: 409, message: 'Feed already saved: https://example.com/rss.xml' });
  });

  test('an invalid body rejects 400 with every validation message', async () => {
    const err = await runTaskErr(
      handleSaveFeedRequest(fakeReq({ url: 'not a url', title: 42 }))
        .runReader(fakeEnv())
    );
    assert.deepEqual(err, { status: 400, message: 'Invalid url; Invalid title' });
  });
});

describe('handleSavedFeedsRequest against a fake env', () => {
  test('resolves 200 with whatever the env’s store remembers', async () => {
    const saved = [{ id: 1, url: 'https://example.com/rss.xml', title: 'Example', createdAt: '2026-01-01 00:00:00' }];
    const result = await runTask(
      handleSavedFeedsRequest().runReader(fakeEnv(makeFakeStore(saved)))
    );
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, saved);
  });
});

describe('handleFeedRequest against a fake env', () => {
  test('a missing url rejects with the shaped 400, no network involved', async () => {
    const req = { method: 'GET', url: '/feed' };
    const err = await runTaskErr(
      handleFeedRequest(req).runReader(fakeEnv())
    );
    assert.deepEqual(err, { status: 400, message: 'Missing url parameter' });
  });
});

describe('handleHealthRequest against a fake env (chapter 21)', () => {
  test('resolves 200 ok with the store’s feed count', async () => {
    const saved = [
      { id: 1, url: 'https://example.com/a.xml', title: 'A', createdAt: '2026-01-01 00:00:00' },
      { id: 2, url: 'https://example.com/b.xml', title: 'B', createdAt: '2026-01-01 00:00:00' },
    ];
    const result = await runTask(
      handleHealthRequest().runReader(fakeEnv(makeFakeStore(saved)))
    );
    assert.deepEqual(result, { status: 200, body: { status: 'ok', feeds: 2 } });
  });

  test('a store that cannot answer rejects with the shaped 503', async () => {
    const brokenStore = {
      ...makeFakeStore(),
      ping: () => Task.rejected(new Error('disk gone')),
    };
    const err = await runTaskErr(
      handleHealthRequest().runReader(fakeEnv(brokenStore))
    );
    assert.deepEqual(err, { status: 503, message: 'Store unavailable: disk gone' });
  });
});
