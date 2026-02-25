# Functions All the Way Down: Chapter 8
## Task.all — Concurrent Operations

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

We have a clean `processFeed` pipeline for a single URL. The aggregator's purpose, though, is aggregating — combining multiple feeds from different sources. Doing them one after another would work, but it's unnecessarily slow. Each feed fetch is independent; there's no reason to wait for the first to finish before starting the second.

This chapter builds `Task.all` — concurrent execution for multiple Tasks — and extends the HTTP server to accept multiple feed URLs in a single request.

## What `Task.all` Should Do

The specification is simple: given an array of Tasks, run them all concurrently, and produce a single Task that resolves with an array of their results (in the same order as the input), or rejects immediately if any of them fails.

This is the same contract as `Promise.all`. The difference is that `Task.all` is lazy — nothing runs until `fork` is called on the result.

## Building It from Scratch

```js
// src/lib/task.js

Task.all = tasks => Task((reject, resolve) => {
  const results = new Array(tasks.length);
  let completed = 0;

  tasks.forEach((task, index) => {
    task.fork(
      reject,                    // any failure immediately rejects the outer Task
      value => {
        results[index] = value;  // store at the correct index to preserve order
        completed += 1;
        if (completed === tasks.length) resolve(results);
      }
    );
  });
});
```

Walk through it. `Task.all` takes an array of Tasks and returns a new Task. That Task, when forked, iterates over the input Tasks and forks each one.

The failure path is `reject` — the outer Task's own reject. Passing it directly to each inner task's fork means any failure immediately bubbles up and rejects the whole operation. You don't need extra logic for fail-fast; it's a consequence of passing the same `reject` through.

The success path accumulates results by index. This matters because Tasks may resolve in any order — a fast feed might finish before a slow one — but the results array should match the input array's order. Using `index` as the key preserves that. When `completed` equals the total number of Tasks, all results are in and we call `resolve(results)`.

## Why Index Matters

Without the index, you might be tempted to do:

```js
value => {
  results.push(value);
  if (results.length === tasks.length) resolve(results);
}
```

This would work, but the order of results would depend on which Task resolved first — whichever feed responded quickest would end up at index 0. If a consumer is combining results from two feeds and expecting them in a specific order, this would be subtly broken in production with variable network timing. The index approach gives you deterministic output regardless of resolution order.

## `processFeeds` — The Aggregator

With `Task.all` built, aggregating multiple feeds becomes a natural extension of what we already have:

```js
// src/fetch-feed.js

export const processFeeds = (...urls) =>
  Task.all(urls.map(processFeed))
    .map(feeds => feeds.flat())
    .map(sortByDateDesc);
```

`urls.map(processFeed)` creates an array of Tasks — one per URL. `Task.all` runs them concurrently and collects the results into an array of arrays (each `processFeed` result is an array of items). `.flat()` merges those into a single array. `sortByDateDesc` sorts the merged result by date so the newest items appear first regardless of which feed they came from.

The entire function returns a Task. Nothing has run yet. The concurrent fetch, parse, normalize, merge, and sort sequence will all happen when you call `.fork()`.

## Extending the Server

The HTTP server gets a `/feeds` route to expose this:

```js
// src/server.js

const handleMultipleFeedsRequest = (req, res) => {
  const { searchParams } = new URL(req.url, `http://localhost:${PORT}`);
  const urls = searchParams.getAll('url');

  if (!urls || !urls.length) {
    return sendError(res, 400, 'Missing url parameter');
  }

  processFeeds(...urls.map(url => url.trim()))
    .fork(
      err   => sendError(res, 500, `Error processing feed: ${err.message}`),
      items => sendJSON(res, 200, items)
    );
};
```

`searchParams.getAll('url')` collects all `url` parameters from the query string — so `/feeds?url=https://...&url=https://...` gives you an array of URLs. The spread (`...urls.map(...)`) passes them as individual arguments to `processFeeds`, which accepts them as rest parameters.

The request hits the server, `handleMultipleFeedsRequest` fires, `processFeeds` builds a Task, `.fork()` triggers it, and when all feeds have resolved the merged result goes back as JSON. If any feed fails — a bad URL, a timeout, a malformed feed — the error propagates immediately and a 500 goes back instead.

You can test it directly:

```
GET /feeds?url=https://feeds.npr.org/1001/rss.xml&url=https://www.theverge.com/rss/index.xml
```

The two feeds are fetched concurrently, their items merged and sorted by date, and the result returned as a single unified list.

## The Honest Limitations

`Task.all` as implemented is functional but not production-hardened. Two gaps worth knowing about:

**No cancellation.** If you fork five Tasks and one fails immediately, the other four continue running in the background. The outer Task's `reject` has already been called, so those results will be discarded — but the network requests still complete. There's no way to tell them to stop. This is a genuine limitation of Tasks built without cancellation semantics. Libraries like [Fluture](https://github.com/fluture-js/Fluture) solve this properly.

**No timeout.** A Task that neither resolves nor rejects will hang forever. Nothing in the current implementation sets a deadline. In production, you'd want a `withTimeout` wrapper — a Task that races the original against a rejection that fires after N milliseconds.

These aren't reasons to avoid Task in your own code. They're reasons to understand what you're working with and reach for a production library when the requirements demand it.

## A Few Things to Sit With

Before chapter nine:

- Look at `server.js` and `fetch-feed.js` side by side. What does each file know about? What does it *not* know about? Where would you go to fix a bug in the feed parsing logic? Where would you go to change how HTTP errors are formatted?
- The functional core and the imperative shell are now complete. `transforms.js`, `maybe.js`, `either.js`, `task.js`, and `fetch-feed.js` form the core — pure functions and lazy Tasks. `server.js` is the shell — HTTP, fork, side effects. Is that boundary clean? Are there any places where shell concerns have leaked into the core, or vice versa?
- Consider what happens if you add a new feature. Say you want to add a `/headlines` endpoint that returns only the title and link of each item. Where does the transformation logic go? Where does the HTTP handling go? Does the architecture make it obvious?

Chapter nine steps back from the code and examines that architecture explicitly — the functional core / imperative shell pattern as an organizing principle for the entire project.
