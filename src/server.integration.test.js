// src/server.integration.test.js
//
// Chapter 21 keeps the promise chapters 12, 13 and 16 deferred:
// the shell gets tested too — end to end, over real HTTP. The real
// server is booted as a child process on an ephemeral port, against
// a temporary database and a local fake feed server, so the suite
// is hermetic: no external network, nothing left behind.
import { test, describe, before, after } from 'node:test';
import assert from 'assert';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fake Feed</title>
    <link>http://example.com/</link>
    <description>A feed that exists only for these tests</description>
    <item>
      <title>First Post</title>
      <link>http://example.com/first</link>
      <pubDate>Mon, 24 Feb 2025 10:00:00 GMT</pubDate>
      <description>The first item</description>
    </item>
    <item>
      <title>Second Post</title>
      <link>http://example.com/second</link>
      <pubDate>Sun, 23 Feb 2025 10:00:00 GMT</pubDate>
      <description>The second item</description>
    </item>
  </channel>
</rss>`;

// A fake feed server: /rss answers at once, /hang never answers.
const fakeFeedServer = http.createServer((req, res) => {
  if (req.url === '/hang') return; // the 3 a.m. feed: silence
  res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
  res.end(RSS);
});

// Find a port the OS says is free, then hand it to the child.
const freePort = () => new Promise((resolve, reject) => {
  const probe = http.createServer();
  probe.on('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

describe('the real server, end to end (chapter 21)', () => {
  let child, base, fakeBase, tmpDir, childOutput = '';

  before(async () => {
    await new Promise(r => fakeFeedServer.listen(0, '127.0.0.1', r));
    fakeBase = `http://127.0.0.1:${fakeFeedServer.address().port}`;

    tmpDir = mkdtempSync(join(tmpdir(), 'fatwd-ch21-'));
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;

    child = spawn(process.execPath, ['src/server.js'], {
      cwd: dirname(fileURLToPath(import.meta.url)) + '/..',
      env: {
        ...process.env,
        PORT: String(port),
        FEEDS_DB: join(tmpDir, 'feeds.db'),
        LOG_LEVEL: 'error',
        FEED_TIMEOUT_MS: '300',
        FEED_RETRIES: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', d => { childOutput += d; });
    child.stderr.on('data', d => { childOutput += d; });

    // Wait until /health answers — the server is really up.
    const deadline = Date.now() + 10000;
    for (;;) {
      try {
        const res = await fetch(`${base}/health`);
        if (res.status === 200) break;
      } catch { /* not listening yet */ }
      if (Date.now() > deadline) throw new Error(`server never came up:\n${childOutput}`);
      await sleep(50);
    }
  });

  after(async () => {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([
        new Promise(r => child.once('exit', r)),
        sleep(6000),
      ]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    await new Promise(r => fakeFeedServer.close(r));
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('GET /health reports ok and an empty store', async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok', feeds: 0 });
  });

  test('GET /feed fetches and normalises the fake feed', async () => {
    const res = await fetch(`${base}/feed?url=${encodeURIComponent(`${fakeBase}/rss`)}`);
    assert.equal(res.status, 200);
    const items = await res.json();
    assert.equal(items.length, 2);
    assert.equal(items[0].title, 'First Post');
    assert.equal(items[0].link, 'http://example.com/first');
  });

  // The chapter-sixteen regression, as a test at last: a missing
  // url is a 400 with the validation message — not a 500 wearing
  // the message as a costume. This is the bug the untested shell
  // hid for three chapters.
  test('GET /feed with no url is the shaped 400 (the ch. 16 regression)', async () => {
    const res = await fetch(`${base}/feed`);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'Missing url parameter' });
  });

  test('POST /feeds saves, and /feeds/saved remembers', async () => {
    const post = await fetch(`${base}/feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: `${fakeBase}/rss`, title: 'Fake Feed' }),
    });
    assert.equal(post.status, 201);

    const saved = await fetch(`${base}/feeds/saved`);
    assert.equal(saved.status, 200);
    const feeds = await saved.json();
    assert.equal(feeds.length, 1);
    assert.equal(feeds[0].title, 'Fake Feed');

    const health = await (await fetch(`${base}/health`)).json();
    assert.equal(health.feeds, 1);
  });

  test('a feed that hangs meets the deadline: 504, not forever', async () => {
    const started = Date.now();
    const res = await fetch(`${base}/feed?url=${encodeURIComponent(`${fakeBase}/hang`)}`);
    assert.equal(res.status, 504);
    const body = await res.json();
    assert.match(body.error, /Timed out after 300 ms/);
    // Two attempts at 300 ms plus one 250 ms wait — and not a second more of patience.
    assert.ok(Date.now() - started < 3000, 'the deadline held');
  });

  test('the server shuts down cleanly on SIGTERM, exit code 0', async () => {
    child.kill('SIGTERM');
    const code = await Promise.race([
      new Promise(r => child.once('exit', r)),
      sleep(6000).then(() => 'still running'),
    ]);
    assert.equal(code, 0);
  });
});
