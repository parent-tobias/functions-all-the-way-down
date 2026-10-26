// src/store.test.js
import { test, describe } from 'node:test';
import assert from 'assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore, rowToFeed } from './store.js';
import { validateFeedInput } from './transforms.js';

// Tasks are lazy; fork one and await the outcome.
const runTask = task => new Promise((resolve, reject) =>
  task.fork(reject, resolve));
const runTaskErr = task => new Promise((resolve, reject) =>
  task.fork(resolve, () => reject(new Error('Expected the Task to reject'))));

describe('rowToFeed', () => {
  test('shapes a full row into a feed', () => {
    const row = { id: 1, url: 'https://example.com/rss.xml', title: 'Example', created_at: '2026-01-01 00:00:00' };
    rowToFeed(row).fold(
      err  => assert.fail(`Unexpected Left: ${err}`),
      feed => assert.deepEqual(feed, {
        id: 1,
        url: 'https://example.com/rss.xml',
        title: 'Example',
        createdAt: '2026-01-01 00:00:00',
      })
    );
  });

  test('falls back to Untitled Feed when the row has no title', () => {
    const row = { id: 2, url: 'https://example.com/rss.xml', title: null, created_at: '2026-01-01 00:00:00' };
    rowToFeed(row).fold(
      err  => assert.fail(`Unexpected Left: ${err}`),
      feed => assert.equal(feed.title, 'Untitled Feed')
    );
  });

  test('returns a Left for a null row', () => {
    rowToFeed(null).fold(
      err  => assert.equal(err, 'Row was null'),
      ()   => assert.fail('Expected a Left')
    );
  });

  test('returns a Left for a row with no url', () => {
    rowToFeed({ id: 3, title: 'No URL here' }).fold(
      err  => assert.equal(err, 'Feed row was missing a url'),
      ()   => assert.fail('Expected a Left')
    );
  });
});

describe('createStore', () => {
  test('saves a feed and loads it back', async () => {
    const store = createStore(':memory:');
    const saved = await runTask(store.saveFeed({ url: 'https://example.com/rss.xml', title: 'Example' }));
    assert.equal(saved.url, 'https://example.com/rss.xml');
    assert.equal(saved.title, 'Example');
    assert.equal(typeof saved.id, 'number');
    assert.equal(typeof saved.createdAt, 'string');

    const feeds = await runTask(store.loadFeeds());
    assert.deepEqual(feeds, [saved]);
    store.close();
  });

  test('loads an empty array from a new store', async () => {
    const store = createStore(':memory:');
    assert.deepEqual(await runTask(store.loadFeeds()), []);
    store.close();
  });

  test('saving the same url twice rejects with a 409 shape', async () => {
    const store = createStore(':memory:');
    await runTask(store.saveFeed({ url: 'https://example.com/rss.xml', title: 'Example' }));
    const err = await runTaskErr(store.saveFeed({ url: 'https://example.com/rss.xml', title: 'Again' }));
    assert.equal(err.status, 409);
    assert.match(err.message, /already saved/i);
    store.close();
  });

  test('a feed saved without a title loads back as Untitled Feed', async () => {
    const store = createStore(':memory:');
    const saved = await runTask(store.saveFeed({ url: 'https://example.com/rss.xml' }));
    assert.equal(saved.title, 'Untitled Feed');
    store.close();
  });

  test('feeds survive closing and reopening the store', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'feeds-db-'));
    const dbPath = join(dir, 'feeds.db');
    try {
      const first = createStore(dbPath);
      await runTask(first.saveFeed({ url: 'https://example.com/rss.xml', title: 'Example' }));
      first.close();

      const second = createStore(dbPath);
      const feeds = await runTask(second.loadFeeds());
      assert.equal(feeds.length, 1);
      assert.equal(feeds[0].url, 'https://example.com/rss.xml');
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('validateFeedInput', () => {
  test('accepts a valid url and title', () => {
    const result = validateFeedInput({ url: 'https://example.com/rss.xml', title: 'Example' });
    assert.deepEqual(result, { valid: true, data: { url: 'https://example.com/rss.xml', title: 'Example' } });
  });

  test('accepts a missing title', () => {
    const result = validateFeedInput({ url: 'https://example.com/rss.xml' });
    assert.deepEqual(result, { valid: true, data: { url: 'https://example.com/rss.xml', title: null } });
  });

  test('collects a missing url and an invalid title at once', () => {
    const result = validateFeedInput({ title: 42 });
    assert.deepEqual(result, { valid: false, errors: ['Missing url', 'Invalid title'] });
  });

  test('rejects a malformed url', () => {
    const result = validateFeedInput({ url: 'not a url' });
    assert.deepEqual(result, { valid: false, errors: ['Invalid url'] });
  });

  test('rejects a non-http url', () => {
    const result = validateFeedInput({ url: 'ftp://example.com/rss.xml' });
    assert.deepEqual(result, { valid: false, errors: ['Invalid url'] });
  });
});
