// src/server.js — The imperative shell
//
// This file is intentionally "impure" — it's where side effects live.
// Its only job: translate HTTP requests into pipeline calls,
// and pipeline results into HTTP responses.

import http from 'node:http';
import { Either } from './lib/either.js';
import { Task }   from './lib/task.js';
import { processFeed, processFeeds, processFeedForDigest } from './fetch-feed.js';

const PORT = 3000;

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
    .mapError(err => ({ status: 500, message: `Error processing feed: ${err.message}` }))
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
    .mapError(err => ({ status: 500, message: `Error processing feeds: ${err.message}` }))
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
    .mapError(err => ({ status: 500, message: `Error processing feed for digest: ${err.message}` }))
    .fork(
      err    => sendError(res, err.status, err.message),
      digest => sendJSON(res, 200, digest)
    );
};

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && pathname === '/feed')  return handleFeedRequest(req, res);
  if (req.method === 'GET' && pathname === '/feeds')  return handleMultipleFeedsRequest(req, res);
  if (req.method === 'GET' && pathname === '/digest') return handleDigestRequest(req, res);

  sendError(res, 404, 'Not found');
});

server.listen(PORT, () => {
  console.log(`Feed aggregator running at http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/feed?url=https://feeds.npr.org/1001/rss.xml`);
});
