# Functions All the Way Down: Chapter 1
## Pure Functions and the Rules of the Game

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

You've been there. You write a function, it works perfectly in isolation, you test it in the console, and everything looks great. Then you drop it into your actual application and suddenly it's returning different things depending on when you call it, or it's quietly mutating data somewhere upstream and causing bugs three function calls away that are an absolute nightmare to trace.

This isn't a skill issue. It's a design issue. And it's exactly the kind of problem that functional programming disciplines help solve.

Over this series, we're going to build a real project together - a Node.js RSS/news feed aggregator API. No frameworks, no unnecessary dependencies. Just ES modules, Node 22's built-in `fetch`, and a growing set of techniques that will make the codebase easier to reason about, test, and extend. You can follow along at [repo link]. This first chapter is about establishing the rules of the game, starting with the concept that underlies most of what we'll build: **pure functions**.

## What Makes a Function "Pure"?

There are exactly two rules.

**Rule one: given the same input, a pure function always returns the same output.** Not usually. Not most of the time. Always. If you call `getTitles(feedItems)` with the same array, you get the same array of titles back. Every time. No surprises.

**Rule two: a pure function has no side effects.** It doesn't write to a database, it doesn't mutate the data it received, it doesn't reach out to an API, it doesn't touch `localStorage`, it doesn't log to the console. It takes something in, it returns something out, and the rest of the world is completely unaffected.

That's it. Two rules. But the consequences of following them consistently are significant.

## The Problem with Impure Code

Consider a function that processes RSS feed items and extracts their titles. Here's a version you might write without thinking too hard about it:

```js
let processedItems = [];

const extractTitles = (items) => {
  processedItems = items.map(item => item.title);
  return processedItems;
};
```

This function works. Call it, get your titles. But notice what it's doing: it's writing to a variable that lives outside itself. That's a side effect. Now `processedItems` is tied to the last time `extractTitles` was called, and any other part of your code that reads `processedItems` is depending on that timing. Functions that depend on *when* they're called rather than *what they're given* are fragile. They're also a pain to test, because you have to manage that external state before each test.

Here's the pure version:

```js
const getTitles = (items) => items.map(item => item.title);
```

Same result. No external state touched. You can call this function a thousand times with the same input and you'll get the same output every time. You can test it by passing in an array and asserting what comes back. Done.

## Currying: Configuration Without Side Effects

Pure functions get really interesting when you start thinking about how to make them configurable without reaching for external state. This is where a pattern called **currying** becomes useful.

Instead of writing a function that takes all its arguments at once, you write a function that takes its configuration first and returns a function that takes the data. The shape looks like this: `config => data => result`.

Think about filtering feed items by a search term. A naive approach might store the search term somewhere and read it when filtering. A curried approach looks like this:

```js
const filterByTitle = (searchTerm) => (items) =>
  items.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
```

Now `filterByTitle` is a function that returns a function. You call it with a search term and you get back a specialized filter. The search term is captured in the closure, not stashed in some shared variable somewhere.

```js
const findNodeNews = filterByTitle('node');
const findSecurityNews = filterByTitle('security');

// Later, both of these work independently and predictably:
const nodeItems = findNodeNews(feedItems);
const securityItems = findSecurityNews(feedItems);
```

Each of those is a pure function. `findNodeNews` will always filter the same way given the same input. You could create a hundred of these specialized filters without any of them interfering with each other.

## The Functional Core / Imperative Shell

Here's the part that trips people up: you can't write an entire application with pure functions. At some point you have to fetch data, write files, respond to HTTP requests. Those things are inherently impure — they interact with the world outside your function.

The practical approach is to be deliberate about where that impurity lives. The idea is called the **functional core / imperative shell**:

- Your **core** is made of pure functions. Data transformation, filtering, sorting, shaping. This is where most of your logic lives, and all of it is testable without mocks or setup.
- Your **shell** is the layer that deals with the outside world. Fetching feeds, writing to disk, handling HTTP requests. This code orchestrates your pure core — it calls your pure functions with real data and does something with the result.

In our aggregator project, the shell will eventually be a small entry point that fetches RSS feeds and passes the raw data into the core. The core functions will do all the interesting transformational work. This chapter is where we start building that core.

## Building `transforms.js`

Let's write the first module of the project. These are the foundational transforms we'll use throughout the series — pure functions that shape raw RSS feed data into something useful.

```js
// src/transforms.js

export const getTitles = (items) =>
  items.map(item => item.title);

export const getLinks = (items) =>
  items.map(item => item.link);

export const filterByTitle = (searchTerm) => (items) =>
  items.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

export const sortByDateDesc = (items) =>
  [...items].sort((a, b) =>
    new Date(b.pubDate) - new Date(a.pubDate)
  );
```

Notice `sortByDateDesc` in particular. `Array.prototype.sort` sorts in place — it mutates the original array. That would be a side effect. By spreading into a new array first (`[...items]`), we're sorting a copy and returning that, leaving the original untouched. This is a habit worth building: when a native method would mutate, copy first.

Every function here takes data in and returns a new value. None of them touch anything outside themselves. All four are pure.

## Testing Pure Functions Is Straightforward

This is one of the most concrete payoffs. Because pure functions don't depend on external state, you don't need a running server, a seeded database, or any mocks to test them. Node 22 ships with `node:test` built in, so we can write a quick test file right now.

```js
// src/transforms.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTitles, filterByTitle, sortByDateDesc } from './transforms.js';

const sampleItems = [
  { title: 'Node.js 22 Released', link: 'https://example.com/1', pubDate: 'Mon, 24 Feb 2025 10:00:00 GMT' },
  { title: 'Understanding Async Iterators', link: 'https://example.com/2', pubDate: 'Tue, 25 Feb 2025 08:30:00 GMT' },
  { title: 'Security Patch for Express', link: 'https://example.com/3', pubDate: 'Sun, 23 Feb 2025 14:00:00 GMT' },
];

test('getTitles returns an array of title strings', () => {
  const result = getTitles(sampleItems);
  assert.deepEqual(result, [
    'Node.js 22 Released',
    'Understanding Async Iterators',
    'Security Patch for Express',
  ]);
});

test('filterByTitle filters case-insensitively', () => {
  const filterForNode = filterByTitle('node');
  const result = filterForNode(sampleItems);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Node.js 22 Released');
});

test('sortByDateDesc does not mutate the original array', () => {
  const original = [...sampleItems];
  sortByDateDesc(sampleItems);
  assert.deepEqual(sampleItems, original);
});
```

Run these with `node --test src/transforms.test.js`. They pass without any test runner setup, without any database, without any HTTP mocking. That's the value of keeping your logic in pure functions — the tests are almost as simple as the functions themselves.

## A Few Things to Sit With

Before we move on to chapter two, consider a few questions:

- We have four independent pure functions right now. What happens when we want to run feed items through several of them in sequence — filter, then sort, then extract titles? Is there a more elegant way to express that chain than nesting function calls?
- `filterByTitle` uses the `config => data => result` currying pattern. Which of the other transforms in this file might benefit from that same treatment? What kind of configuration would make sense?
- We've separated pure logic from impure I/O conceptually. But how exactly should the shell layer call into these functions once we have real data coming back from a `fetch`? What does that boundary actually look like in code?

Those are the threads we'll pull on in chapter two, where we get into function composition and start hooking the pure core up to real network data.
