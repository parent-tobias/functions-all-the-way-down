# Functions All the Way Down: Chapter 7
## Task — Lazy Async Computation

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

So far, everything we've built is synchronous. Pure functions, Maybe, Either — these all operate in the present tense. You give them a value; they give you a value back. The entire computation happens inline.

Fetching an RSS feed is different. You send a request and wait. The data arrives at some unknown point in the future. If it fails, you want to handle the error. JavaScript's answer to this is the Promise, and Promises are fine — but they have a property that makes them difficult to treat as values in a functional pipeline.

Promises are eager.

## The Problem with Eagerness

The moment you write `fetch(url)`, the request goes out. You can't hold a Promise representing "the act of fetching this URL" without that fetch already being in flight. You can't pass it to a function, configure it, or store it — by the time you have a reference to it, the operation has already started.

This matters for composition. If you want to build a pipeline that fetches a feed, parses it, and normalizes the items — and you want to wire that pipeline up *before* triggering any of it — you can't do that with Promises directly. The moment you call `fetch`, you've started.

Task is the alternative. A Task represents a future computation without executing it. Nothing happens until you explicitly call `.fork()`. Until then, it's just a description of work to be done.

## Building Task from Scratch

Task is built around a single function: the computation it will eventually run.

```js
// src/lib/task.js

export const Task = fork => ({
  fork,

  map: fn => Task((reject, resolve) => {
    fork(reject, x => resolve(fn(x)));
  }),

  chain: fn => Task((reject, resolve) => {
    fork(reject, x => {
      const nextTask = fn(x);
      nextTask.fork(reject, resolve);
    });
  }),

  fold: (leftFn, rightFn) => Task((reject, resolve) => {
    fork(
      err => resolve(leftFn(err)),
      x   => resolve(rightFn(x))
    );
  }),
});

Task.of       = x => Task((reject, resolve) => resolve(x));
Task.rejected = x => Task((reject, resolve) => reject(x));
```

`Task` takes a function — the computation — and returns an object with `map`, `chain`, `fold`, and `fork`. The computation function takes two callbacks: `reject` for failure, `resolve` for success. This mirrors the Promise constructor, but nothing runs until `fork` is called.

Notice the convention: `reject` comes first, before `resolve`. Error handling is first-class, not an afterthought.

## `map` and `chain` on Tasks

The methods look different from Maybe and Either, but the semantics are identical.

`map` on a Task: when the task eventually resolves, apply `fn` to the result and resolve with the new value.

```js
Task.of(5)
  .map(x => x * 2)
  .fork(
    err => console.error('Error:', err),
    val => console.log('Value:', val)   // Value: 10
  );
```

`chain` on a Task: when the task eventually resolves, call `fn` with the result (which returns another Task), and fork *that* task. This is how you sequence async operations.

```js
const fetchText = url => Task((reject, resolve) =>
  fetch(url)
    .then(res => res.text())
    .then(resolve)
    .catch(reject)
);

const parseJSON = text => Task((reject, resolve) => {
  try {
    resolve(JSON.parse(text));
  } catch (err) {
    reject(err);
  }
});

fetchText('https://example.com/data.json')
  .chain(parseJSON)
  .fork(
    err => console.error('Failed:', err),
    data => console.log('Data:', data)
  );
```

`chain` here sequences two async operations without nesting callbacks or `.then()` chains. Each `Task` is a description; `chain` wires them together into a larger description. Nothing runs until `fork`.

## Building `processFeed`

In the project, we wrap `fetch` and `rss-parser` in Tasks, then compose them:

```js
// src/fetch-feed.js

import { Task } from './lib/task.js';
import Parser from 'rss-parser';

const parser = new Parser();

const fetchFeed = url => Task((reject, resolve) => {
  fetch(url)
    .then(res =>
      res.ok
        ? res.text()
        : Promise.reject(new Error(`Failed to fetch feed (${res.status}): ${res.statusText}`))
    )
    .then(resolve)
    .catch(reject);
});

const parseFeed = raw => Task((reject, resolve) =>
  parser.parseString(raw)
    .then(resolve)
    .catch(reject)
);
```

`fetchFeed` wraps the network call. `parseFeed` wraps the parser. Both follow the same shape: wrap an existing async API in a Task constructor, routing the success callback to `resolve` and the error callback to `reject`.

Then `processFeed` chains them together with pure transforms in the middle:

```js
export const processFeed = (url, { category, search } = {}) =>
  fetchFeed(url)
    .chain(parseFeed)
    .map(feed => feed.items)
    .map(items => items.map(normalizeItem))
    .map(items => items.filter(item => item.valid))
    .map(items => items.map(item => item.data))
    .map(when(category, filterByCategory(category)))
    .map(when(search, filterBySearch(search)))
    .map(sortByDateDesc);
```

This entire function returns a Task. Nothing runs when you call `processFeed(url)`. You get back a description of "fetch this URL, parse it as RSS, normalize the items, filter by category and search if specified, sort by date." The operations are assembled in order, but idle.

When you call `.fork()` on the result — which happens in `server.js` — that's when everything executes.

## `fork` as the Escape Hatch

`fork` is Task's equivalent of `fold` for Either or `getOrElse` for Maybe. It's the one place where you leave the functional world and hand control to the outside world.

```js
processFeed('https://feeds.npr.org/1001/rss.xml')
  .fork(
    err   => console.error('Feed failed:', err.message),
    items => console.log('Got', items.length, 'items')
  );
```

The first function handles failure; the second handles success. Both are called with plain values — no Task, no wrapper. The Task is done.

This is where the architectural principle firms up: **`fork` only belongs in the shell**. The functional core — `transforms.js`, the Maybe and Either logic, `processFeed` — never calls `fork`. It builds Tasks and transforms them. The shell — `server.js` — is where `fork` lives, where the results get turned into HTTP responses.

## Laziness as a Feature

The laziness of Task has a practical consequence beyond composability: you can pass `processFeed(url)` around as a value before triggering it. You can build up a collection of Tasks, configure them differently, and decide when and how to run them.

This becomes important in the next chapter when we handle multiple feeds concurrently. You can have ten `processFeed` Tasks sitting idle, configured for different URLs, and trigger all of them at once. With Promises, those ten fetches would already be in flight.

## A Few Things to Sit With

Before chapter eight:

- We now have a way to process a single feed. What if we want to aggregate five feeds and merge the results? We could call `processFeed` five times and wait for each sequentially — but that's slower than necessary. Is there a way to run them concurrently and collect all the results?
- `Task.all` for Promises is `Promise.all`. What would the equivalent look like for Tasks? How would you run multiple Tasks in parallel, collect their results in order, and produce a single Task with an array of results?
- If one of those five feeds fails, what should happen? Should the whole thing fail immediately (fail-fast), or should the others continue and you collect partial results?

Chapter eight builds `Task.all` from scratch, wires it into a `/feeds` endpoint that accepts multiple URLs, and discusses what the fail-fast behaviour means in practice.
