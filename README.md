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

## Running the Project

```bash
npm install
node src/server.js
```

Then try:

```
GET http://localhost:3000/feed?url=https://feeds.npr.org/1001/rss.xml
GET http://localhost:3000/feeds?url=https://feeds.npr.org/1001/rss.xml&url=https://www.theverge.com/rss/index.xml
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
  server.js              — HTTP server (the imperative shell)
  index.js               — Scratchpad / examples
  lib/
    fp-utils.js          — Reusable FP utilities (pipe, compose, pluck, etc.)
    fp-utils.test.js
    maybe.js             — Maybe monad (safe null handling)
    maybe.test.js
    either.js            — Either monad (errors as values)
    either.test.js
    task.js              — Task monad (lazy async computation)
docs/
  OUTLINE.md             — Full series outline
  chapter-*.md           — Article drafts
```

## No Framework Dependencies

The only production dependency is `rss-parser` (used in chapter 7 onwards to parse RSS feeds). Everything else — the HTTP server, the test runner, `fetch` — comes built into Node 22.
