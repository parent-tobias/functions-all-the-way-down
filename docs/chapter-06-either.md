# Functions All the Way Down: Chapter 6
## Either — Errors as Values

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

Maybe handles absence. If a value might not be there, Maybe lets you operate on it safely without checking at every step. But Maybe's failure state — `Nothing` — tells you nothing about *why* something is absent. It's a silent shrug.

Real validation rarely wants silence. When an RSS feed item fails normalization, you want to know whether the title was missing, the link was null, or the item itself was undefined. That information is useful for logging, for debugging, for displaying meaningful errors. `Nothing` discards it.

Either keeps it.

## Right and Left

Either is built from two constructors: `Right`, which holds a successful value, and `Left`, which holds a failure. The naming comes from mathematical convention — right is correct, left is the error path — and it's worth just accepting rather than overthinking.

Both `Right` and `Left` have identical interfaces, just as `Just` and `Nothing` do. The difference is in behaviour:

```js
// src/lib/either.js

export const Right = x => ({
  map:   fn => Right(fn(x)),
  chain: fn => fn(x),
  filter: (predicate, leftValue) => predicate(x) ? Right(x) : Left(leftValue),
  getOrElse: defaultVal => x,
  fold:  (leftFn, rightFn) => rightFn(x),
  inspect: () => `Right(${x})`,
});

export const Left = x => ({
  map:   fn => Left(x),      // ignore fn, propagate the error
  chain: fn => Left(x),      // ignore fn, propagate the error
  filter: (predicate, leftValue) => Left(x),
  getOrElse: defaultVal => defaultVal,
  fold:  (leftFn, rightFn) => leftFn(x),
  inspect: () => `Left(${x})`,
});

export const Either = {
  of: x => Right(x),
  fromNullable: (x, leftValue = 'Value was null') =>
    (x === null || x === undefined) ? Left(leftValue) : Right(x),
};
```

The structural pattern is identical to Maybe. `Right.map` applies the function; `Left.map` ignores it. `Right.chain` calls the function; `Left.chain` ignores it. A failure anywhere in a chain of operations produces a `Left` that propagates through the rest of the chain unchanged — the first failure wins.

The difference from Maybe: `Left` holds a value. It carries the error message, the reason for failure, whatever you put there. That value is available when you extract it at the end.

## `fromNullable` with a Message

`Either.fromNullable` works like `Maybe.of` but takes an optional second argument — the `Left` value to use if the first is null:

```js
Either.fromNullable(item.title, 'Title was null');
// Right('Node.js 22 Released') if title exists
// Left('Title was null') if title is null or undefined
```

This is how you front-load error messages. Instead of checking for null and throwing, you check once and turn the result into an Either. From that point, the rest of the chain operates on a `Right` if things are fine, or propagates the `Left` if they're not.

## `fold` as the Exit

Every container type we've built has an exit. Maybe's exit is `getOrElse` — provide a fallback if it's `Nothing`. Either's exit is `fold`.

`fold` takes two functions: one for the `Left` case, one for the `Right`. It applies the appropriate one and returns a plain value — no more container. You get what you got, in the form you decide.

```js
Either.of(5)
  .fold(
    err => `Error: ${err}`,
    val => `Success: ${val}`
  );
// 'Success: 5'

Either.fromNullable(null, 'Not found')
  .fold(
    err => `Error: ${err}`,
    val => `Success: ${val}`
  );
// 'Error: Not found'
```

Unlike `getOrElse`, which only handles the `Nothing` path, `fold` forces you to handle both. You can't get a value out of an Either without deciding what to do in both cases. This is the boundary principle: when you leave the functional world and return a plain value, you account for every outcome explicitly.

## Applying It: `normalizeItem`

This is where Either earns its place in the project. An RSS feed item goes through normalization before we use it. Normalization can fail in several ways: the item itself might be null, the title might be missing, the link might be missing. Each failure has a distinct message.

Here's `normalizeItem` built with Either:

```js
export const normalizeItem = item =>
  Either.fromNullable(item, 'Item was null')
    .chain(i =>
      Either.fromNullable(i.title, 'Title was null')
        .map(title => ({ ...i, title }))
    )
    .chain(i =>
      Either.fromNullable(i.link, 'Link was null')
        .map(link => ({ ...i, link }))
    )
    .map(i => ({
      title: i.title,
      link: i.link,
      summary: firstOf('description', 'content')(i) || 'No description available',
      author: getAuthorName(i),
      categories: firstOf('categories', 'tags')(i) || [],
      pubDate: i.pubDate,
    }))
    .fold(
      err => ({ valid: false, error: err }),
      item => ({ valid: true, data: item })
    );
```

Read through it step by step. `Either.fromNullable(item, 'Item was null')` wraps the item — `Right(item)` if it exists, `Left('Item was null')` if not. The first `.chain` validates the title: it wraps `i.title` in `Either.fromNullable`, and if it's there, maps the spread to add it explicitly to the item. The second `.chain` does the same for the link.

If any step produces a `Left`, every subsequent `.chain` and `.map` is skipped. The `Left` propagates unchanged. `.fold` at the end handles both outcomes: a `Left` becomes `{ valid: false, error: err }`, a `Right` becomes `{ valid: true, data: item }`.

The caller receives a plain object — no container — and can check `result.valid` to know whether to use `result.data` or log `result.error`.

## Railway Oriented Programming

There's a useful mental model for this pattern called **railway oriented programming**. Imagine two parallel tracks: a success track and a failure track. `Right` values ride the success track; `Left` values ride the failure track.

Each `.chain` or `.map` is a switch on the success track. If you're on the success track, you go through the switch and might continue or get diverted to the failure track. If you're already on the failure track, you bypass every switch — the switches only operate on success-track values.

`fold` is where the tracks merge at the end. Both tracks end at `fold`, and `fold` decides what to do with whichever track you arrived on.

This model makes it easy to reason about error propagation. You don't need to trace through the code to understand when errors can occur — they always propagate forward once introduced, and they're always handled explicitly at `fold`.

## The Shape of the Result

One consequence of `fold` producing `{ valid: false, error }` or `{ valid: true, data }` is that callers don't use Either themselves — they get a plain result object. This is deliberate. The functional core uses Either internally for clean error propagation. The boundary — the place where results leave the pure core — converts Either to a shape that's easier for consumers to work with.

In the `processFeed` pipeline, it looks like this:

```js
.map(items => items.map(normalizeItem))
.map(items => items.filter(item => item.valid))
.map(items => items.map(item => item.data))
```

Normalize everything, filter out invalid items, unwrap the data. The Either never leaves `normalizeItem`. The pipeline sees plain objects.

## A Few Things to Sit With

Before chapter seven:

- `normalizeItem` is pure and synchronous. But fetching the RSS feed isn't — it's a network request that takes time and might fail. How do you represent an operation that hasn't happened yet?
- Promises are the JavaScript-native answer to async. But Promises are eager: the moment you create one, it starts running. Is there a way to represent a future operation that *hasn't started yet* — one you can configure and compose without triggering it?
- Consider the difference between "a value that might be absent" (Maybe), "a value that represents either success or failure" (Either), and "a value that represents something that will happen in the future" (something we haven't built yet). All three are containers. All three have `map` and `chain`. Does that pattern hold for async operations?

Chapter seven introduces Task — a lazy container for async computation that composes with the same methods you've been using.
