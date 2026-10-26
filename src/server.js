// src/server.js — The imperative shell
//
// This file is intentionally "impure" — it's where side effects live.
// Its only job: translate HTTP requests into pipeline calls,
// and pipeline results into HTTP responses.

import http from 'node:http';
import { Either, Left } from './lib/either.js';
import { Task }   from './lib/task.js';
import { IO } from './lib/io.js';
import { processFeed, processFeeds, processFeedForDigest } from './fetch-feed.js';
import { createStore } from './store.js';
import { validateFeedInput } from './transforms.js';

const getPort = IO(() => process.env.API_PORT || 3000);
const logger = message => IO(() => console.log(message));

const sendJSON  = (res, status, data)    => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};
const sendError = (res, status, message) =>
  sendJSON(res, status, { error: message });

// Route: GET /feed?url=<feed_url>[&category=...][&search=...]
const handleFeedRequest = (req, res) => {
  const { searchParams } = new URL(req.url, `http://localhost:${PORT}`);
  const url      = searchParams.get('url');
  const category = searchParams.get('category');
  const search   = searchParams.get('search');

  Either.fromNullable(url, {status:400, message: 'Missing url parameter'})
    .fold(Task.rejected, Task.of)
    .chain(url => processFeed(url, { category, search }))
    .mapError(err => err && typeof err.status === 'number' ? err : ({ status: 500, message: `Error processing feed: ${err.message ?? err}` }))
    .fork(
      err   => sendError(res, err.status, err.message),
      items => sendJSON(res, 200, items)
    );
};

// Route: GET /feeds?url=<url1>&url=<url2>...
const handleMultipleFeedsRequest = (req, res) => {
  const { searchParams } = new URL(req.url, `http://localhost:${PORT}`);
  const urls = searchParams.getAll('url');

  Either.of(urls)
    .filter(urls => urls.length > 0, {status:400, message: 'Missing url parameter'})
    .fold(Task.rejected, Task.of)
    .chain(urls => processFeeds(...urls.map(url => url.trim())))
    .mapError(err => err && typeof err.status === 'number' ? err : ({ status: 500, message: `Error processing feeds: ${err.message ?? err}` }))
    .fork(
      err   => sendError(res, err.status, err.message),
      items => sendJSON(res, 200, items)
    );
};

// Route: GET /digest?url=<feed_url>
const handleDigestRequest = (req, res) => {
  const { searchParams } = new URL(req.url, `http://localhost:${PORT}`);
  const url = searchParams.get('url');

  Either.fromNullable(url, {status:400, message: 'Missing url parameter'})
    .fold(Task.rejected, Task.of)
    .chain(processFeedForDigest)
    .mapError(err => err && typeof err.status === 'number' ? err : ({ status: 500, message: `Error processing feed for digest: ${err.message ?? err}` }))
    .fork(
      err    => sendError(res, err.status, err.message),
      digest => sendJSON(res, 200, digest)
    );
};

// The store is opened once, at startup — the same single boundary
// moment where getPort.run() reads the environment. The database path
// comes from FEEDS_DB, with a plain default. (One direct env read,
// for now; it's startup, and startup is shell.)
const store = createStore(process.env.FEEDS_DB || 'feeds.db');

// Read a request body as a Task. Parsing happens here, at the
// boundary; a body that isn't JSON is a 400 before anything else runs.
const readBody = req => Task((reject, resolve) => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('error', reject);
  req.on('end', () => {
    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
    } catch {
      reject({ status: 400, message: 'Invalid JSON body' });
    }
  });
});

// Route: POST /feeds  { url, title? } — save a feed (Chapter 19)
// The series' first write endpoint. Validation accumulates every
// problem with the body at once; the result crosses the same
// Either → Task bridge as the read handlers.
const handleSaveFeedRequest = (req, res) => {
  readBody(req)
    .chain(body => {
      const result = validateFeedInput(body);
      return (result.valid
        ? Either.of(result.data)
        : Left({ status: 400, message: result.errors.join('; ') }))
        .fold(Task.rejected, Task.of);
    })
    .chain(feed => store.saveFeed(feed))
    .mapError(err => err && typeof err.status === 'number' ? err : ({ status: 500, message: `Error saving feed: ${err.message ?? err}` }))
    .fork(
      err  => sendError(res, err.status, err.message),
      feed => sendJSON(res, 201, feed)
    );
};

// Route: GET /feeds/saved — the feeds the app remembers
const handleSavedFeedsRequest = (req, res) => {
  store.loadFeeds()
    .mapError(err => ({ status: 500, message: `Error loading saved feeds: ${err.message ?? err}` }))
    .fork(
      err   => sendError(res, err.status, err.message),
      feeds => sendJSON(res, 200, feeds)
    );
};

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && pathname === '/feed')  return handleFeedRequest(req, res);
  if (req.method === 'GET' && pathname === '/feeds')  return handleMultipleFeedsRequest(req, res);
  if (req.method === 'GET' && pathname === '/digest') return handleDigestRequest(req, res);
  if (req.method === 'POST' && pathname === '/feeds')       return handleSaveFeedRequest(req, res);
  if (req.method === 'GET' && pathname === '/feeds/saved')  return handleSavedFeedsRequest(req, res);

  sendError(res, 404, 'Not found');
});

const PORT = getPort.run();

server.listen(PORT, () => {
  logger(`Feed aggregator running at http://localhost:${PORT}`)
    .chain(() => logger(`Try: http://localhost:${PORT}/feed?url=https://feeds.npr.org/1001/rss.xml`))
    .run();
});
