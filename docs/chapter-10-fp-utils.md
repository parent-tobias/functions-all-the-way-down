# Functions All the Way Down: Chapter 10
## Utility Libraries and Reusability

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

Throughout the project, certain patterns have appeared in multiple places. The `config => data => result` shape shows up in every filter function. Trying several field names in order shows up in `normalizeItem`, in `filterByCategory`, in `filterBySummary`. Conditionally applying a transformation shows up in `processFeed`.

When a pattern shows up in your domain code, you can leave it there. When the same pattern shows up in unrelated parts of your domain code, it probably belongs somewhere else — a shared utility module with no domain knowledge of its own.

That's `fp-utils.js`. Let's walk through it.

## `pipe` and `compose`

We built these in chapter three. They're the foundational composition tools.

```js
export const compose = (...fns) => x =>
  fns.reduceRight((acc, fn) => fn(acc), x);

export const pipe = (...fns) => x =>
  fns.reduce((acc, fn) => fn(acc), x);
```

Both are domain-agnostic — they know nothing about RSS feeds, items, or any specific data. They're mathematical operations on functions, and they belong in a utilities module precisely because any codebase using functional composition would want them.

## `getProp` and `pluck`

```js
export const getProp = (prop) => (item) => item[prop];
export const pluck   = (prop) => (items) => items.map(getProp(prop));
```

`getProp` is the curried property accessor: given a property name, return a function that extracts that property from an object. `pluck` extends it across an array.

The reason these exist as named utilities rather than inlined arrows is reuse. `pluck('title')` is `getTitles`. `pluck('link')` is `getLinks`. If you add a need to extract `pubDate` from a list, you have it immediately. The domain functions become declarations rather than implementations:

```js
export const getTitles = pluck('title');
export const getLinks  = pluck('link');
```

The fact that these are one-liners tells you they're correctly abstracted.

## `firstOf` — The Coalesce Pattern

```js
export const firstOf = (...keys) => obj =>
  keys.map(k => obj[k]).find(v => v != null);
```

`firstOf` tries a list of property names on an object and returns the first non-null value. This handles the common reality of RSS feeds: different parsers, different standards, and different fields for the same data.

Some feeds use `description`; others use `content`. Some use `categories`; others use `tags`. Some use `author`; others use `dc:creator`. Rather than writing conditional logic each time, `firstOf` expresses the intent directly:

```js
const summary    = firstOf('description', 'content')(item) || 'No description';
const categories = firstOf('categories', 'tags')(item) || [];
const author     = firstOf('author', 'dc:creator')(item);
```

One detail worth noting: `firstOf` uses `v != null` (loose inequality), not `v !== null`. The loose check catches both `null` and `undefined`, which is what you want when a field might be missing versus explicitly set to null. This is one of the few places in modern JavaScript where loose equality is the right choice.

## `identity`

```js
export const identity = x => x;
```

The identity function returns whatever it receives, unchanged. This sounds useless until you need a no-op in a higher-order function context.

`identity` is useful as a default: if no transformation is specified, use identity, which does nothing. It's also useful in `fold` when you want to pass the Left or Right value through without modification.

You might be tempted to skip testing identity on the grounds that it's obvious. That's fine — but recognize that it matters to have it available as a named function rather than writing `x => x` inline everywhere. A named identity is self-documenting; an anonymous `x => x` makes the reader ask why you wrote it.

## `when` — Conditional Application

```js
export const when = (condition, fn) =>
  condition ? fn : identity;
```

`when` returns `fn` if `condition` is truthy, or `identity` if it's not. This makes conditional pipeline steps readable:

```js
export const processFeed = (url, { category, search } = {}) =>
  fetchFeed(url)
    .chain(parseFeed)
    .map(feed => feed.items)
    .map(items => items.map(normalizeItem))
    .map(items => items.filter(item => item.valid))
    .map(items => items.map(item => item.data))
    .map(when(category, filterByCategory(category)))
    .map(when(search,   filterBySearch(search)))
    .map(sortByDateDesc);
```

The last two `.map()` calls apply filters only if the parameters were provided. Without `when`, you'd need to break out of the pipeline:

```js
let items = await fetchAndProcess(url);
if (category) items = filterByCategory(category)(items);
if (search)   items = filterBySearch(search)(items);
```

That works, but it's imperative and interrupts the pipeline's flow. `when` keeps the conditional logic inside the composition without branching.

The key insight: `when(category, filterByCategory(category))` evaluates to either `filterByCategory(category)` (a function) or `identity` (also a function). Either way, `.map()` receives a function. The pipeline continues uninterrupted.

## `anyPass` — Predicate Combination

```js
export const anyPass = (...predicates) =>
  value => predicates.some(pred => pred(value));
```

`anyPass` takes multiple predicates and returns a new predicate that passes if *any* of the originals pass. This is logical OR for predicates.

In the project, it appears in `matchesSearch`:

```js
const matchesSearch = keyword => item =>
  anyPass(
    i => i.title.toLowerCase().includes(keyword.toLowerCase()),
    i => i.summary.toLowerCase().includes(keyword.toLowerCase())
  )(item);
```

This is equivalent to:

```js
const matchesSearch = keyword => item =>
  item.title.toLowerCase().includes(keyword.toLowerCase()) ||
  item.summary.toLowerCase().includes(keyword.toLowerCase());
```

The `anyPass` version is more verbose here — the inline version is probably cleaner for this specific case. But `anyPass` becomes valuable when you have many predicates, when the predicates come from configuration, or when you want to express the combination separately from where it's applied:

```js
const isNewsworthy = anyPass(
  isBreakingNews,
  isTrending,
  isFromTrustedSource
);

items.filter(isNewsworthy);
```

Named predicate combinations become readable domain concepts rather than inline boolean expressions.

## The Vocabulary

Taken together, `fp-utils.js` gives the project a vocabulary for expressing data transformations:

- **`pipe`/`compose`** — sequence functions
- **`pluck`** — extract a field from each item in a list
- **`firstOf`** — try field names in preference order
- **`identity`** — pass through unchanged
- **`when`** — conditionally apply a transform
- **`anyPass`** — combine predicates with OR

None of these knows anything about RSS feeds. None of them would be out of place in a completely different codebase. They're vocabulary for *computing with values*, not for *processing feeds*.

This is what a well-designed utility library looks like: small, focused, domain-agnostic functions that express common computational patterns. The domain code uses these as building blocks; the utilities have no knowledge of the domain.

If you've used Ramda, Lodash/fp, or other functional utility libraries, much of what's here will look familiar. The difference is that you built these from scratch, which means you understand exactly what they do and why. If you want to compare against production implementations, the appendix points to Ramda — it's the most direct comparison to what we've built.

## A Few Things to Sit With

Before the testing chapters:

- `fp-utils.js` has no tests yet. Which of these utilities would benefit most from explicit tests? Which are simple enough that the tests would just be noise?
- Consider `firstOf`. What happens if you call it with no keys? What happens if none of the keys exist on the object? Are those behaviours you'd want to document with tests?
- `when` returns either a function or `identity`. What does `when(false, filterByTitle('node'))` return? What does `when(true, filterByTitle('node'))` return? Write those tests in your head — do they capture the intended behaviour completely?

Chapters eleven and twelve are the testing chapters. Eleven covers pure functions; twelve covers the algebraic types. We'll come back to `fp-utils.js` in twelve and write proper tests for the utilities we've discussed here.
