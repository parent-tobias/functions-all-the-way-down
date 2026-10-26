# Functions All the Way Down

**Building an API using Functional Programming in Node.js**

This is the companion repository for the article series *Functions All the Way Down*, which walks through building a real RSS feed aggregator API using functional programming principles — no frameworks, no unnecessary dependencies, just ES modules, Node 22's built-in `fetch`, and a growing set of FP techniques.

## Reading the Series

Each chapter has a corresponding git tag. To see the code exactly as it exists at the end of a given chapter, check out that tag:

```bash
git checkout chapter-01   # Pure functions
git checkout chapter-06   # Either and normalizeItem
git checkout chapter-08   # Task.all and the full server
```

To return to the latest code:

```bash
git checkout main
```

## Chapter Tags

| Tag | Chapter |
|-----|---------|
| `chapter-01` | Pure Functions and the Rules of the Game |
| `chapter-02` | Currying and Partial Application |
| `chapter-03` | Function Composition with `pipe` |
| `chapter-04` | Maybe — Safe Null Handling |
| `chapter-05` | `map` vs `chain` — The Key Distinction |
| `chapter-06` | Either — Errors as Values |
| `chapter-07` | Task — Lazy Async Computation |
| `chapter-08` | Task.all — Concurrent Operations |
| `chapter-09` | Separating What from How |
| `chapter-10` | Utility Libraries and Reusability |
| `chapter-11` | Testing Pure Functions — The Payoff |
| `chapter-12` | Testing Algebraic Types |
| `chapter-13` | TDD with Functional Programming |
| `chapter-14` | Putting It Together — Building the /digest Feature |
| `chapter-15` | Composing Types — The Either → Task Bridge |
| `chapter-16` | Completing Task — `mapError` and Consistent Error Shapes |
| `chapter-17` | Collecting Failures — The Validation Type |
| `chapter-18` | Taming Sync Side Effects — The IO Type |
| `chapter-19` | Persistence — The App Remembers |
| `chapter-20` | Reader — Dependencies as an Argument |
| `chapter-21` | Production — Running It for Real |
| `chapter-22` | What You've Actually Built |

## Running the Project

```bash
npm install
node src/server.js
```

Then try:

```
GET http://localhost:3000/feed?url=https://feeds.npr.org/1001/rss.xml
GET http://localhost:3000/feeds?url=https://feeds.npr.org/1001/rss.xml&url=https://www.theverge.com/rss/index.xml
POST http://localhost:3000/feeds          { "url": "https://feeds.npr.org/1001/rss.xml", "title": "NPR" }
GET http://localhost:3000/feeds/saved
GET http://localhost:3000/health
```

Configuration is read once at startup and validated as a whole — if anything
is wrong, every problem is reported and the server does not start:

```
PORT=3000 FEEDS_DB=feeds.db LOG_LEVEL=info FEED_TIMEOUT_MS=10000 FEED_RETRIES=2 node src/server.js
```

## Running the Tests

```bash
npm test
```

## Project Structure

```
src/
  transforms.js          — Pure data transformations (the functional core)
  transforms.test.js     — Tests for the core transforms
  fetch-feed.js          — Task-based feed fetching and processing
  digest.js              — The /digest feature (chapter 14)
  digest.test.js         — Tests for the digest feature
  server.js              — HTTP server (the imperative shell)
  server.integration.test.js — End-to-end tests against the real server (chapter 21)
  handlers.test.js       — Handler tests against a fake env (chapter 20)
  store.js               — SQLite persistence via node:sqlite (chapter 19)
  store.test.js
  config.js              — Validated startup configuration (chapter 20)
  config.test.js
  logger.js              — Level-filtered logger built on IO (chapter 20)
  index.js               — Scratchpad / examples
  lib/
    fp-utils.js          — Reusable FP utilities (pipe, compose, pluck, etc.)
    fp-utils.test.js
    maybe.js             — Maybe monad (safe null handling)
    maybe.test.js
    either.js            — Either monad (errors as values)
    either.test.js
    task.js              — Task monad (lazy async computation)
    task.test.js
    validation.js        — Validation type (accumulating errors; chapter 17)
    validation.test.js
    io.js                — IO type (lazy sync side effects; chapter 18)
    io.test.js
    reader.js            — Reader / ReaderTask (dependencies as an argument; chapter 20)
    reader.test.js
docs/
  OUTLINE.md             — Full series outline
  chapter-*.md           — Article drafts
```

## No Framework Dependencies

The only production dependency is `rss-parser` (used in chapter 7 onwards to parse RSS feeds). Everything else — the HTTP server, the test runner, `fetch`, and, from chapter 19, SQLite via Node's built-in `node:sqlite` — comes built into Node 22.
