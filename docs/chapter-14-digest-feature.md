# Functions All the Way Down: Chapter 14
## Putting It Together — Building the /digest Feature

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

The first thirteen chapters of this series built the tools: pure functions, currying, pipe, Maybe, Either, Task, Task.all, the functional core / imperative shell architecture, testing. What follows is about using them.

A new feature is the best kind of review. When a design is sound, adding something new should feel natural. The types compose without fighting you. The architecture tells you where each piece belongs. You spend your time thinking about the problem, not the plumbing.

The `/digest` endpoint is a summary of a feed: how many items it contains, the date range they cover, the most common categories, a handful of recent headlines. Simple enough to be concrete; complex enough to exercise the full stack.

## Designing Before Coding

Before writing a single line, sketch the shape of the problem.

The digest has five fields. Four of them are straightforward transformations of the normalized items: count is `items.length`, recent headlines are a slice of sorted items mapped through `toHeadline`, top categories are a frequency count, date range is derived from the first and last item. The fifth — `feedTitle` — comes from the raw feed object, not the items.

This tells us something about the function's signature. `buildDigest` needs access to both: the raw feed (for metadata) and the normalized items (for derived statistics). You can't discard the feed object after extracting `.items`, the way `processFeed` does, because you still need the title.

The full digest shape:

```js
{
  feedTitle:     'NPR News',
  itemCount:     50,
  dateRange:     { newest: '...', oldest: '...' },
  topCategories: ['News', 'Politics', 'Health'],
  recentItems:   [{ title, link, date }, ...],
}
```

With the shape clear, you can design the pure functions before writing any of them.

## Where Does the Code Live?

`transforms.js` is a shared library — functions used across routes. But `getDateRange`, `topCategories`, and `buildDigest` are specific to the digest. They're not reused elsewhere, and they encode decisions that belong to the `/digest` route.

The natural home is a route-named file: `src/digest.js`. If the route ever grows — say, `?count=10` to configure how many recent items to return — that logic stays co-located. Route-specific transforms live in route-named files. Shared transforms live in `transforms.js`.

This is a small organizational decision, but it pays dividends when the project grows. You know immediately where to look, and you know immediately what's shared vs. what's owned.

## Maybe vs Either: Choosing the Right Type

`getDateRange` needs to handle an empty feed. If there are no items, there's no date range to report. How should it communicate that?

Ask yourself: is the absence of a date range *an error*, or is it simply *what happens with an empty feed*?

An empty feed isn't a bug. It isn't a validation failure. It's a legitimate state that the caller should handle gracefully — perhaps by omitting the field from the response, or rendering "no items" in a UI. The absence carries no message, no reason, no culpability. It's just absent.

That's Maybe.

```js
export const getDateRange = (items) =>
  items.length === 0
    ? Maybe.nothing()
    : Maybe.of({
        newest: items[0].pubDate,
        oldest: items[items.length - 1].pubDate,
      });
```

Contrast this with `normalizeItem`, which uses Either. A missing title *is* an error — it means the item is malformed, and the specific message ("Title was null") is useful information for debugging. Either carries that message in a `Left`. Maybe wouldn't; `Nothing` is silent.

The rule of thumb: **Maybe for absence without judgment; Either for failure with a reason.**

When you call `getDateRange([]).getOrElse(null)` in `buildDigest`, you're saying: if there's no date range, use null. No explanation needed. The caller decides what null means in context.

## Currying for Configuration

`topCategories` needs to be configurable — the number of categories to return is a parameter. But it also needs to be usable as a plain `items => result` function, droppable into any pipeline.

Currying solves both:

```js
export const topCategories = (n) => (items) => {
  const counts = items
    .flatMap(item => item.categories)
    .reduce((acc, cat) => ({ ...acc, [cat]: (acc[cat] || 0) + 1 }), {});

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([cat]) => cat);
};

export const top5Categories = topCategories(5);
```

`topCategories(5)` returns a configured function: `items => [string]`. You can pass it to `.map()`, compose it with `pipe`, or store it as `top5Categories` for repeated use. The number 5 is baked in; the function is ready for any list of items.

This is the chapter-two pattern applied in practice. Currying isn't just a technique for its own sake — it's what lets you configure behaviour once and apply it many times, without the configuration tangling with the data.

## Assembling the Digest

`buildDigest` is straightforward once the helpers exist:

```js
export const buildDigest = (rawFeed, items) => ({
  feedTitle:     Maybe.of(rawFeed.title).getOrElse('Untitled Feed'),
  itemCount:     items.length,
  dateRange:     getDateRange(items).getOrElse(null),
  topCategories: top5Categories(items),
  recentItems:   items.slice(0, 5).map(toHeadline),
});
```

`Maybe.of(rawFeed.title).getOrElse('Untitled Feed')` handles the case where the feed has no title gracefully. `.getOrElse(null)` on `getDateRange` converts `Nothing` to `null` for JSON serialization. Everything else is a direct transformation.

No conditionals, no early returns, no null checks. Each field is an expression that either produces a value or falls back to a default.

## Testing First

The pure core of the digest is fully testable before any async work is written. `getDateRange` takes an array and returns a Maybe; `topCategories` takes a number and items and returns strings; `buildDigest` takes objects and returns an object. No network, no mocks, no test infrastructure.

Writing the tests first reveals the contract clearly:

```js
test('getDateRange returns Nothing for an empty array', () => {
  assert.strictEqual(getDateRange([]).getOrElse(null), null);
});

test('getDateRange returns { newest, oldest } for a non-empty array', () => {
  assert.deepStrictEqual(getDateRange(sampleItems).getOrElse(null), {
    newest: 'Tue, 25 Feb 2025 10:00:00 GMT',
    oldest: 'Sun, 23 Feb 2025 14:00:00 GMT',
  });
});
```

The empty-array test doesn't assert that `getDateRange([])` is `Nothing` directly — it asserts on what `.getOrElse(null)` returns. You're testing the behaviour from the outside, not the implementation detail of which variant you got. If you refactor `getDateRange` to return null directly instead of `Maybe.nothing()`, the test still passes. That's the right level of abstraction.

Note one subtlety: when testing `topCategories`, categories with tied frequencies can appear in any order. Asserting the exact array position of tied entries would be brittle. Use `.includes('Node')` and `.includes('JavaScript')` rather than `assert.deepStrictEqual(['Node', 'JavaScript', ...])`. The test should describe what the contract guarantees — top categories by frequency — not the order of tied entries, which is an implementation detail.

## A Few Things to Sit With

Before chapter fifteen:

- `buildDigest` has its pure functions tested, but nothing runs yet. The feature still needs a Task that fetches the feed and keeps the raw feed metadata alongside the normalized items. How is that different from `processFeed`, which discards the feed after extracting `.items`?
- The `/feed` and `/feeds` handlers in `server.js` use an `if (!url) return sendError(...)` guard before entering the Task pipeline. That's an imperative check — it works, but it breaks the pipeline style. If you validated with `Either.fromNullable` instead, how would you chain that validation into the Task that processes the feed?
- The answer involves converting an Either into a Task at the point where synchronous validation hands off to async computation. What would that conversion look like, and what does the resulting single-expression handler tell you about the shape of the problem?

Chapter fifteen wires up the async layer and introduces the pattern for bridging Either and Task in a single pipeline.
