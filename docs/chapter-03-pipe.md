# Functions All the Way Down: Chapter 3
## Function Composition with `pipe`

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

Chapter 2 ended with a question about chaining. We have several `items => result` functions — filter by title, sort by date, extract titles. To run items through all three in sequence right now, you'd write something like:

```js
getTitles(sortByDateDesc(filterByTitle('node')(items)));
```

Read that carefully. The execution order is right to left — `filterByTitle` runs first, then `sortByDateDesc`, then `getTitles` — but the code reads left to right. You have to mentally unwind it. And this is only three functions. Add a fourth or fifth and it becomes genuinely hard to follow.

There's a better way.

## What `pipe` Is

`pipe` is a function that takes a list of functions and returns a new function. When you call that new function with a value, it passes the value through each function in turn — the output of each becoming the input of the next.

```js
const pipeline = pipe(
  filterByTitle('node'),
  sortByDateDesc,
  getTitles
);

const results = pipeline(feedItems);
```

This reads in execution order, left to right. The data flows through the pipeline the same way you read the code. `filterByTitle('node')` runs first, its output goes to `sortByDateDesc`, that output goes to `getTitles`. No mental unwinding required.

`pipe` is the opposite of mathematical function composition, which chains right to left. If you've seen `compose` elsewhere, `pipe` is the same idea but in the order that most people find more readable. We'll use `pipe` throughout this project.

## Building `pipe` from Scratch

Here's the implementation:

```js
export const pipe = (...fns) => x =>
  fns.reduce((acc, fn) => fn(acc), x);
```

That's it. Eleven tokens. Let's read it.

`pipe` takes any number of functions via rest parameters. It returns a new function that takes a single value `x`. That function calls `reduce` on the array of functions, starting with `x` as the accumulator. At each step, it calls the current function with the accumulated value and passes the result forward.

The connection to `reduce` is worth sitting with. `reduce` threads a value through a list of operations — that's precisely what `pipe` does. The only difference is that the "operations" here are functions rather than arithmetic. `reduce` is `pipe` for values; `pipe` is `reduce` for functions.

You'll also see `compose` implemented the same way but with `reduceRight`:

```js
export const compose = (...fns) => x =>
  fns.reduceRight((acc, fn) => fn(acc), x);
```

`compose(f, g, h)(x)` means `f(g(h(x)))` — right to left, the mathematical convention. `pipe(f, g, h)(x)` means `f` then `g` then `h` — left to right, how most people read code. Both live in `fp-utils.js`; we'll default to `pipe` from here on.

## Using `pipe` with Our Transforms

With `pipe` available, we can refactor any sequence of transforms into a readable pipeline. A function that finds the most recent Node.js news and returns their titles:

```js
import { pipe } from './lib/fp-utils.js';
import { filterByTitle, sortByDateDesc, getTitles } from './transforms.js';

const getLatestNodeTitles = pipe(
  filterByTitle('node'),
  sortByDateDesc,
  getTitles
);

// Later:
const titles = getLatestNodeTitles(feedItems);
```

`getLatestNodeTitles` is a pure function. It was built entirely from smaller pure functions. You can call it a thousand times with the same input and get the same output. It's testable without mocks or setup. And it reads like a description of what it does.

This is the payoff of getting the function shapes right. Because `filterByTitle('node')` returns `items => items`, and `sortByDateDesc` is `items => items`, and `getTitles` is `items => something_else`, they snap together. `pipe` doesn't know anything about RSS feeds or dates or keywords — it just threads a value through whatever functions you give it.

## Point-Free Style

You may have noticed that `getLatestNodeTitles` is defined without ever mentioning `items`:

```js
// With an explicit parameter:
const getLatestNodeTitles = (items) => getTitles(sortByDateDesc(filterByTitle('node')(items)));

// Point-free, with pipe:
const getLatestNodeTitles = pipe(
  filterByTitle('node'),
  sortByDateDesc,
  getTitles
);
```

Both are equivalent. The second style — defining a function by describing its transformation rather than its argument — is called **point-free**. The "point" in "point-free" refers to the argument (a holdover from mathematical terminology).

Point-free style isn't a goal in itself. It's a side effect of writing functions that compose cleanly. When your functions have consistent shapes — `data => result`, `config => data => result` — they snap together in pipelines without needing to explicitly mention the data flowing through them. The code ends up describing *what happens* rather than *how it happens step by step*.

It can be overused. A pipeline of ten functions with obscure names becomes unreadable quickly. Use it where it aids clarity, not as a rule.

## Updating `fp-utils.js`

`pipe` and `compose` live in `fp-utils.js`, which also holds the other reusable utilities we've been building — `getProp`, `pluck`, and more to come. Here's the module so far:

```js
// src/lib/fp-utils.js

export const compose = (...fns) => x =>
  fns.reduceRight((acc, fn) => fn(acc), x);

export const pipe = (...fns) => x =>
  fns.reduce((acc, fn) => fn(acc), x);

export const getProp = (prop) => (item) => item[prop];

export const pluck = (prop) => (items) => items.map(getProp(prop));
```

`pipe` and `compose` are domain-agnostic — they know nothing about RSS feeds, items, or any of our specific data shapes. They're pure functions that work on functions. That's exactly the kind of utility that belongs in a shared module.

## A Note on `index.js`

As the project grows, `index.js` serves as a scratchpad for wiring things together. You can try out a pipeline there without any HTTP machinery:

```js
// src/index.js
import { pipe } from './lib/fp-utils.js';
import { filterByTitle, sortByDateDesc, getTitles } from './transforms.js';

const sampleItems = [
  { title: 'Node.js 22 Released', pubDate: 'Mon, 24 Feb 2025 10:00:00 GMT' },
  { title: 'Security Patch for Express', pubDate: 'Sun, 23 Feb 2025 14:00:00 GMT' },
  { title: 'Node 22 Performance Improvements', pubDate: 'Sat, 22 Feb 2025 09:00:00 GMT' },
];

const getLatestNodeTitles = pipe(
  filterByTitle('node'),
  sortByDateDesc,
  getTitles
);

console.log(getLatestNodeTitles(sampleItems));
// ['Node.js 22 Released', 'Node 22 Performance Improvements']
```

Run it with `node src/index.js`. The output is sorted newest-first because `sortByDateDesc` ran before `getTitles`. Swap their positions in the `pipe` call and you'd get an error, because `getTitles` returns strings, not objects with `pubDate`. The function shapes enforce a natural order.

## A Few Things to Sit With

Before we move on to chapter four:

- Every function we've written so far operates on values that are definitely present. But RSS feeds are messy — items sometimes lack an author, a description, or even a title. How do you handle a missing value without scattering `if (value !== null)` checks through every function?
- One approach is to keep checking at every step. Another is to wrap potentially-absent values in a container that handles the absence for you. What would that container look like?
- Consider the `author` field on a feed item. Sometimes it's a string. Sometimes it's an object with a `name` property. Sometimes it's missing entirely. A pure function that normalizes an author has to handle all three cases without crashing. How?

Chapter four introduces Maybe — a small container that handles absent values gracefully, letting you write transformations that work the same way whether there's a value there or not.
