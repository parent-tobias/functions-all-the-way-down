// src/server.js — The imperative shell
//
// This file is intentionally "impure" — it's where side effects live.
// Its only job: translate HTTP requests into pipeline calls,
// and pipeline results into HTTP responses.
//
// Chapter 20: the handlers no longer reach for module-level imports.
// Each handler is a ReaderTask — a computation that is *given* its
// environment ({ config, store, logger }) and produces a Task that
// resolves to a response description, { status, body }. The env is
// built once, in main(), and supplied once, at the fork boundary.
// Handlers can therefore be run against a fake env in tests, with no
// database, no HTTP and no rewiring of imports.
//
// Chapter 21: production. Feed fetches run under a timeout and a
// retry policy taken from the config; /health reports whether the
// store can answer; every request is logged through the env's
// logger; and main() answers SIGTERM/SIGINT by draining in-flight
// requests and closing the store before it exits.

import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { Either, Left } from './lib/either.js';
import { Task, isTimeoutError }   from './lib/task.js';
import { ReaderTask } from './lib/reader.js';
import { processFeed, processFeeds, processFeedForDigest } from './fetch-feed.js';
import { createStore } from './store.js';
import { parseConfig } from './config.js';
import { makeLogger } from './logger.js';
import { validateFeedInput } from './transforms.js';

const sendJSON  = (res, status, data)    => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};
const sendError = (res, status, message) =>
  sendJSON(res, status, { error: message });

// Chapter 21: the network is the one part of a feed request that can
// hang or flap, so it is the part that gets a deadline and retries —
// each attempt races the configured timeout, and a rejection earns
// another attempt after the backoff schedule's wait. Validation
// errors happen before this wrapper is ever reached, so a 400 is
// never retried. A timeout arrives already shaped ({ status: 504 }),
// and the handlers' mapError passes shaped errors — timeouts
// included, recognised by isTimeoutError or by their status —
// through untouched, exactly as chapter sixteen taught.
const RETRY_BASE_DELAY_MS = 250;

const withResilience = (task, config) =>
  task
    .timeout(config.feedTimeoutMs)
    .retry(config.feedRetries, RETRY_BASE_DELAY_MS);

const isShapedError = err =>
  !!err && (isTimeoutError(err) || typeof err.status === 'number');

// Route: GET /feed?url=<feed_url>[&category=...][&search=...]
export const handleFeedRequest = req => ReaderTask(env => {
  const { searchParams } = new URL(req.url, `http://localhost:${env.config.port}`);
  const url      = searchParams.get('url');
  const category = searchParams.get('category');
  const search   = searchParams.get('search');

  return Either.fromNullable(url, {status:400, message: 'Missing url parameter'})
    .fold(Task.rejected, Task.of)
    .chain(url => withResilience(processFeed(url, { category, search }), env.config))
    .mapError(err => isShapedError(err) ? err : ({ status: 500, message: `Error processing feed: ${err.message ?? err}` }))
    .map(items => ({ status: 200, body: items }));
});

// Route: GET /feeds?url=<url1>&url=<url2>...
export const handleMultipleFeedsRequest = req => ReaderTask(env => {
  const { searchParams } = new URL(req.url, `http://localhost:${env.config.port}`);
  const urls = searchParams.getAll('url');

  return Either.of(urls)
    .filter(urls => urls.length > 0, {status:400, message: 'Missing url parameter'})
    .fold(Task.rejected, Task.of)
    .chain(urls => withResilience(processFeeds(...urls.map(url => url.trim())), env.config))
    .mapError(err => isShapedError(err) ? err : ({ status: 500, message: `Error processing feeds: ${err.message ?? err}` }))
    .map(items => ({ status: 200, body: items }));
});

// Route: GET /digest?url=<feed_url>
export const handleDigestRequest = req => ReaderTask(env => {
  const { searchParams } = new URL(req.url, `http://localhost:${env.config.port}`);
  const url = searchParams.get('url');

  return Either.fromNullable(url, {status:400, message: 'Missing url parameter'})
    .fold(Task.rejected, Task.of)
    .chain(url => withResilience(processFeedForDigest(url), env.config))
    .mapError(err => isShapedError(err) ? err : ({ status: 500, message: `Error processing feed for digest: ${err.message ?? err}` }))
    .map(digest => ({ status: 200, body: digest }));
});

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
// Either → Task bridge as the read handlers. The difference from
// chapter 19: the store arrives as part of the environment.
export const handleSaveFeedRequest = req => ReaderTask(env =>
  readBody(req)
    .chain(body => {
      const result = validateFeedInput(body);
      return (result.valid
        ? Either.of(result.data)
        : Left({ status: 400, message: result.errors.join('; ') }))
        .fold(Task.rejected, Task.of);
    })
    .chain(feed => env.store.saveFeed(feed))
    .mapError(err => err && typeof err.status === 'number' ? err : ({ status: 500, message: `Error saving feed: ${err.message ?? err}` }))
    .map(feed => ({ status: 201, body: feed }))
);

// Route: GET /feeds/saved — the feeds the app remembers
export const handleSavedFeedsRequest = () => ReaderTask(env =>
  env.store.loadFeeds()
    .mapError(err => ({ status: 500, message: `Error loading saved feeds: ${err.message ?? err}` }))
    .map(feeds => ({ status: 200, body: feeds }))
);

// Route: GET /health — is the app actually able to do its job?
// Chapter 21. The check is a real query against the store, not a
// hardcoded "fine": if the store can count its feeds, the app is
// up; if it can't, the honest answer is a shaped 503.
export const handleHealthRequest = () => ReaderTask(env =>
  env.store.ping()
    .map(count => ({ status: 200, body: { status: 'ok', feeds: count } }))
    .mapError(err => ({ status: 503, message: `Store unavailable: ${err.message ?? err}` }))
);

const route = req => {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && pathname === '/feed')        return handleFeedRequest(req);
  if (req.method === 'GET' && pathname === '/feeds')       return handleMultipleFeedsRequest(req);
  if (req.method === 'GET' && pathname === '/digest')      return handleDigestRequest(req);
  if (req.method === 'POST' && pathname === '/feeds')      return handleSaveFeedRequest(req);
  if (req.method === 'GET' && pathname === '/feeds/saved') return handleSavedFeedsRequest();
  if (req.method === 'GET' && pathname === '/health')      return handleHealthRequest();
  return null;
};

// Startup — the shell's one moment of assembly. Configuration is
// parsed once and validated as a whole: on Failure, every accumulated
// error is printed and the process exits without starting anything.
// On Success, the environment is built — config, store, logger — and
// handed to the handlers at the fork boundary, the only place in the
// program where an environment is ever supplied.
export const main = () => {
  parseConfig(process.env).fold(
    errors => {
      console.error('Invalid configuration — the server will not start:');
      errors.forEach(error => console.error(`  ${error}`));
      process.exit(1);
    },
    config => {
      const env = {
        config,
        store:  createStore(config.feedsDb),
        logger: makeLogger(config.logLevel),
      };

      // Chapter 21: how many requests are between arrival and
      // response right now. The graceful shutdown below drains
      // against this count; the request log reports against it too.
      let inFlight = 0;

      const server = http.createServer((req, res) => {
        const startedAt = Date.now();
        inFlight += 1;
        res.on('finish', () => {
          inFlight -= 1;
          const { pathname } = new URL(req.url, 'http://localhost');
          env.logger
            .info(`${req.method} ${pathname} ${res.statusCode} ${Date.now() - startedAt}ms`)
            .run();
        });

        const handler = route(req);
        if (!handler) return sendError(res, 404, 'Not found');

        handler.runReader(env).fork(
          err => sendError(res, err.status, err.message),
          ({ status, body }) => sendJSON(res, status, body)
        );
      });

      server.listen(config.port, () => {
        env.logger.info(`Feed aggregator running at http://localhost:${config.port}`)
          .chain(() => env.logger.info(`Try: http://localhost:${config.port}/feed?url=https://feeds.npr.org/1001/rss.xml`))
          .run();
      });

      // Graceful shutdown — the lifecycle's other boundary. On
      // SIGTERM/SIGINT: stop accepting new connections, let the
      // requests already in flight finish (up to a short drain
      // cap — a stuck request must not hold the process hostage),
      // then close the store — chapter nineteen's close(), finally
      // called — log the sequence, and exit 0.
      const DRAIN_CAP_MS = 5000;
      let shuttingDown = false;

      const shutdown = signal => {
        if (shuttingDown) return;
        shuttingDown = true;
        env.logger.info(`${signal} received — draining ${inFlight} in-flight request(s)`).run();

        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          clearTimeout(deadline);
          env.store.close();
          env.logger.info('Store closed — shutdown complete').run();
          process.exit(0);
        };
        const deadline = setTimeout(() => {
          env.logger.warn(`Drain cap reached with ${inFlight} request(s) still in flight — closing anyway`).run();
          finish();
        }, DRAIN_CAP_MS);
        if (deadline.unref) deadline.unref();

        server.close(() => {
          env.logger.info('All requests drained').run();
          finish();
        });
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT',  () => shutdown('SIGINT'));
    }
  );
};

// Importing this module (as the handler tests do) must not start
// anything — main() runs only when the file itself is the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
