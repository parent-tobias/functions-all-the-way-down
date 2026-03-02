# Functions All the Way Down: Chapter 2
## Currying and Partial Application

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

Chapter 1 ended with a question: `filterByTitle` uses the `config => data => result` pattern. Which of the other transforms might benefit from the same treatment?

That question is worth sitting with for a moment, because the answer isn't obvious until you think about how functions actually get *used*. A pure function is useful in isolation. What makes functional code *compositional* — what makes it possible to wire functions together into pipelines — is this specific pattern of separating configuration from data.

Let's go deeper.

## The Difference Between Configuring and Running

When you call `filterByTitle('node')`, you're not filtering anything yet. You're creating a *configured filter* — a specialized function that already knows what it's looking for, waiting for data to arrive. The search term is the configuration; the items array is the data.

```js
const filterByTitle = (searchTerm) => (items) =>
  items.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

// Configuration step — returns a function, doesn't touch any data:
const findNodeNews = filterByTitle('node');

// Data step — happens later, possibly much later:
const results = findNodeNews(feedItems);
```

These two calls can be separated in time and space. You might configure `findNodeNews` once at application startup and call it inside a request handler without re-specifying the search term. This is **partial application** — supplying some of a function's arguments upfront and deferring the rest until you have the data.

This is fundamentally different from how most imperative code handles configuration. You either call a function with all its arguments at once, or you stash configuration in a shared variable somewhere. Partial application gives you a third option: freeze the configuration *into* a function and carry that function around.

What makes this work mechanically is the **closure**. When `filterByTitle('node')` executes, `searchTerm` is captured by the inner function — it remains accessible even after `filterByTitle` has returned. The configuration isn't stashed in an external variable; it lives inside the returned function itself, invisible to the outside world. Closures are not an edge case of JavaScript — they're the mechanism behind partial application, and they'll keep appearing throughout this series in increasingly useful shapes.

## Building More Curried Transforms

With that distinction in mind, let's look at what else our transforms module would benefit from.

Filtering by keyword in the title is useful, but RSS feed items have other filterable dimensions. They have categories. Their summaries might mention something the title doesn't. Both follow the same shape:

```js
export const filterByCategory = (category) => (items) => {
  return items.filter(item => {
    const categories = firstOf('categories', 'tags')(item) || [];
    return categories.includes(category);
  });
};

export const filterBySummary = (keyword) => (items) =>
  items.filter(item => {
    const summary = firstOf('description', 'content')(item) || '';
    return summary.toLowerCase().includes(keyword.toLowerCase());
  });
```

Both are `config => data => result`. Both can be partially applied, stored, and composed. A `findJavaScriptArticles` configured at startup will work just as reliably as `findNodeNews`. They're the same shape, just different configurations.

The `firstOf` utility you see there — trying `'categories'` first and falling back to `'tags'` — is something we'll build in a later chapter. The point for now is that the curried structure is what makes these functions composable, regardless of what complexity lives inside them.

## Currying Isn't Just for Filtering

Filtering is the obvious use case, but the pattern shows up anywhere you have a value that controls how a transformation should behave.

Consider extracting a property from each item in a list. You might start here:

```js
const getTitles = items => items.map(item => item.title);
const getLinks  = items => items.map(item => item.link);
```

These work, but every new property requires a new function. The curried version generalizes the pattern:

```js
const getProp = (prop) => (item) => item[prop];
const pluck   = (prop) => (items) => items.map(getProp(prop));
```

Now `getTitles` and `getLinks` are one-liners:

```js
export const getTitles = pluck('title');
export const getLinks  = pluck('link');
```

`pluck('title')` isn't "pluck title from something" — it's "a function that, given a list of items, extracts the title from each one." The property name is locked in; the data comes later. If you need to extract a dozen different fields, you configure twelve specialized extractors from a single general function without writing twelve separate functions.

## What "Higher-Order Functions" Actually Means

You'll see the term **higher-order function** come up frequently in functional programming discussions, and it sounds abstract until you realize you've been writing them this whole time.

A higher-order function is just a function that either:
- takes another function as an argument, or
- returns a function as its result

By that definition, every curried function we've written is higher-order. `pluck` takes a property name and returns a function. `filterByTitle` takes a search term and returns a function. When you partially apply them, the result is itself a function — a configured, specialized version ready for data.

`Array.prototype.map` and `Array.prototype.filter` are also higher-order functions — they take a function and apply it to each element. This is why curried functions and array methods compose so naturally. The function that `pluck` returns is exactly the shape that `.map()` expects.

## The Emerging Shape

Look at the transforms module so far and a pattern emerges:

```js
// Extractors — items => result, ready to apply immediately:
export const getTitles = pluck('title');
export const getLinks  = pluck('link');

// Filters — config => items => result, need partial application first:
export const filterByTitle    = (searchTerm) => (items) => ...
export const filterByCategory = (category)   => (items) => ...
export const filterBySummary  = (keyword)    => (items) => ...

// Sorters — items => result, ready to apply immediately:
export const sortByDateDesc = (items) => [...items].sort(...)
```

These functions divide cleanly by their *signature shape*. Extractors and sorters are `items => result` — they're ready to go. Filters are `config => items => result` — they need to be configured first, producing an `items => result` function.

That second group is what enables composition. Once you've called `filterByTitle('node')`, what you have is functionally identical to `sortByDateDesc` — it takes items and returns items. It can go anywhere in a pipeline. We'll exploit that in the next chapter when we build `pipe`.

## Updating the Tests

Since we've added new transforms, we should add corresponding tests. The shape is the same as the tests in chapter 1:

```js
// src/transforms.test.js

const sampleItems = [
  {
    title: 'Node.js 22 Released',
    categories: ['Node', 'JavaScript'],
    pubDate: 'Mon, 24 Feb 2025 10:00:00 GMT',
  },
  {
    title: 'Understanding Async Iterators',
    categories: ['JavaScript'],
    pubDate: 'Tue, 25 Feb 2025 08:30:00 GMT',
  },
  {
    title: 'Security Patch for Express',
    tags: ['Security', 'Node'],   // note: tags, not categories
    pubDate: 'Sun, 23 Feb 2025 14:00:00 GMT',
  },
];

test('filterByCategory finds items by category name', () => {
  const filterForJavaScript = filterByCategory('JavaScript');
  const result = filterForJavaScript(sampleItems);
  assert.equal(result.length, 2);
});

test('filterByCategory works with items that use "tags" instead of "categories"', () => {
  const filterForSecurity = filterByCategory('Security');
  const result = filterForSecurity(sampleItems);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Security Patch for Express');
});
```

The second test is the one worth paying attention to. Our implementation handles both `categories` and `tags` transparently, and the test documents that behaviour explicitly. Tests on pure functions double as specifications.

## A Few Things to Sit With

Before we get to chapter three:

- We now have several `items => result` functions that could be chained together — filter, then sort, then extract. Right now, chaining them means nesting calls: `getTitles(sortByDateDesc(filterByTitle('node')(items)))`. That's right to left, which reads backwards from how it executes. What would a cleaner way to express that look like?
- `pipe` is the answer, and it's built with `reduce`. Can you see the connection? `reduce` threads a value through a list of operations — which is exactly what we want to do with our functions.
- `filterBySearch` in the current codebase checks both the title *and* the summary. That requires combining two predicates with OR logic. How might you express that combination as a reusable utility, rather than hardcoding it into the filter function?

Chapter three builds `pipe` from scratch, shows its connection to `reduce`, and refactors the transforms pipeline into something that reads like a description of what it does.
