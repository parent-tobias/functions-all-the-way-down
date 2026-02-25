// src/server.js — The imperative shell
//
// This file is intentionally "impure" — it's where side effects live.
// Its only job: translate HTTP requests into pipeline calls,
// and pipeline results into HTTP responses.
//
// The functional core never changes. Only this shell knows about HTTP.

import http from 'node:http';
import { processFeed, processFeeds } from './fetch-feed.js';

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
  const url = searchParams.get('url');

  if (!url) return sendError(res, 400, 'Missing url parameter');

  processFeed(url)
    .fork(
      err   => sendError(res, 500, `Error processing feed: ${err.message}`),
      items => sendJSON(res, 200, items)
    );
};

// Route: GET /feeds?url=<url1>&url=<url2>...
const handleMultipleFeedsRequest = (req, res) => {
  const { searchParams } = new URL(req.url, `http://localhost:${PORT}`);
  const urls = searchParams.getAll('url');

  if (!urls || !urls.length) return sendError(res, 400, 'Missing url parameter');

  processFeeds(...urls.map(url => url.trim()))
    .fork(
      err   => sendError(res, 500, `Error processing feed: ${err.message}`),
      items => sendJSON(res, 200, items)
    );
};

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && pathname === '/feed')  return handleFeedRequest(req, res);
  if (req.method === 'GET' && pathname === '/feeds') return handleMultipleFeedsRequest(req, res);

  sendError(res, 404, 'Not found');
});

server.listen(PORT, () => {
  console.log(`Feed aggregator running at http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/feed?url=https://feeds.npr.org/1001/rss.xml`);
});
