# Functions All the Way Down: Chapter 4
## Maybe — Safe Null Handling

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

There's a famous quote attributed to Tony Hoare, the computer scientist who invented the null reference: "I call it my billion-dollar mistake." He was describing the cost, in crashes and bugs and lost engineering hours, of allowing a reference to hold the absence of a value. Null is contagious. One null in the wrong place propagates up a call stack, bypassing every transformation that assumed it wouldn't be there.

In our RSS aggregator, this shows up immediately. Feed items sometimes have an author. Sometimes they don't. Sometimes the author is a string. Sometimes it's an object with a `name` property. Write a `getAuthorName` function without thinking carefully about this and you'll either get crashes on missing data, or you'll scatter null checks through the function until it barely resembles a transformation anymore.

There's a better approach.

## The Problem with Defensive Null Checks

The naive version of `getAuthorName` might look like this:

```js
const getAuthorName = (item) => {
  if (!item.author && !item['dc:creator']) return 'Unknown Author';
  const author = item.author || item['dc:creator'];
  if (typeof author === 'string') return author;
  if (author && author.name) return author.name;
  return 'Unknown Author';
};
```

This works. But look at what it's doing: every line is asking "do I have a value?" The actual transformation logic — `author.name` — is buried inside conditionals. And this is a simple case. In a real pipeline, this kind of defensive checking accumulates quickly, and each check is a place you can forget to check, or check incorrectly.

The functional approach inverts the problem. Instead of checking for null before each operation, wrap the potentially-absent value *once* and let the wrapper handle the checking for you.

## Just and Nothing

The Maybe type is built from two constructors: `Just`, which holds a value, and `Nothing`, which holds the absence of one. Both have identical interfaces — they respond to the same methods — but they behave differently.

Here's the implementation:

```js
// src/lib/maybe.js

export const Just = x => ({
  map: fn => Just(fn(x)),
  chain: fn => fn(x),
  filter: fn => fn(x) ? Just(x) : Nothing(),
  getOrElse: defaultVal => x,
  inspect: () => `Just(${x})`,
});

export const Nothing = () => ({
  map: fn => Nothing(),
  chain: fn => Nothing(),
  filter: fn => Nothing(),
  getOrElse: defaultVal => defaultVal,
  inspect: () => 'Nothing',
});

export const Maybe = {
  of: x => (x === null || x === undefined) ? Nothing() : Just(x),
  nothing: () => Nothing(),
};
```

Notice something about `Just`: the value `x` isn't stored as a property on the returned object. There's no `maybe.value`, no `maybe._x`. The only way to reach `x` is through the methods — `map`, `chain`, `getOrElse` — all of which close over it. This is the same closure mechanism from chapter two, now applied to a data structure. Where currying used closures to freeze configuration into a function, `Just` uses them to seal a value inside a container. The container controls all access to what it holds.

The key is in the symmetry. Both `Just` and `Nothing` have `map`, `chain`, `filter`, and `getOrElse`. Code that calls `.map()` on a Maybe doesn't need to know whether it has a value — it just calls `.map()`. If it's a `Just`, the function runs and a new `Just` comes out. If it's `Nothing`, the function is skipped and `Nothing` comes out. The absence propagates automatically.

## Walking Through It

Here's `Maybe` in use:

```js
const result = Maybe.of('hello')
  .map(s => s.toUpperCase())
  .map(s => s + '!')
  .getOrElse('nothing there');

console.log(result); // 'HELLO!'
```

Now with null:

```js
const empty = Maybe.of(null)
  .map(s => s.toUpperCase())  // skipped — Nothing propagates
  .map(s => s + '!')          // skipped — still Nothing
  .getOrElse('nothing there');

console.log(empty); // 'nothing there'
```

Both chains call `.map()` twice and `.getOrElse()` once. The code is identical. The difference is entirely in what `Maybe.of` produced — a `Just` for the non-null case, a `Nothing` for the null case. From that point on, you just call the same methods and let the container handle it.

`getOrElse` is the exit: it takes the value out of the Maybe, providing a fallback if it's a `Nothing`. You call it at the end of the chain, at the point where you actually need a plain value. This forces you to declare your default at the boundary rather than sprinkling `|| 'Unknown'` throughout the code.

## Applying It: Author Normalization

Here's how Maybe cleans up `getAuthorName`:

```js
const authorToString = author =>
  typeof author === 'string' ? author : author?.name;

const getAuthorName = obj =>
  Maybe.of(firstOf('author', 'dc:creator')(obj))
    .map(authorToString)
    .getOrElse('Unknown Author');
```

`firstOf('author', 'dc:creator')(obj)` tries the `author` field first, then `dc:creator`, returning whichever isn't null. `Maybe.of` wraps the result: if both were missing, it's a `Nothing`; otherwise it's a `Just`. `.map(authorToString)` converts the value to a string only if there's something there. `.getOrElse('Unknown Author')` extracts the result, using the fallback if there's nothing.

Three lines. No conditionals. And the logic of "try these fields, convert to string, default to unknown" is readable in sequence.

## `Maybe.of` as the Smart Constructor

Notice that the safety is front-loaded. `Maybe.of` is the one place that checks for null/undefined. After that, every `.map()` on the chain is safe — you're operating on the `Just`/`Nothing` container, not on the raw value. You never need to check inside your transformation functions.

This is the design principle at work: validate at the boundary, operate confidently inside. When a value enters the Maybe system, it's wrapped. From that point, you treat it as a Maybe and let the type handle the absent case.

This is also why `Maybe.of` and `Just` are separate. `Maybe.of` is safe — it inspects the value and produces the right container. `Just` is the constructor that assumes you already have a value. Using `Just` directly means you've checked; using `Maybe.of` means you're asking the type to check.

## What `filter` Does

`Just` and `Nothing` also implement `filter`. It works exactly as you'd expect:

```js
Maybe.of(5)
  .filter(x => x > 10)
  .getOrElse(0);
// 0 — the 5 didn't pass the predicate, so Nothing came out
```

If the predicate returns false, `Just` becomes `Nothing`. This lets you express "I have a value, but only care about it if it meets a condition" in the same pipeline style, without breaking out of the chain.

## A Few Things to Sit With

Before we move on:

- We've been using `.map()` on Maybe to apply a transformation. But what if the transformation itself returns a Maybe? For example, `authorToString` returns a string — but what if you had a function that returned `Maybe.of(something)`? What would `.map()` give you in that case?
- Maybe's strength is handling absent values. But sometimes absence isn't the only thing that can go wrong. What if you need to know *why* something failed, not just that it did? Maybe's `Nothing` carries no information — it just says "there's nothing here." Is there a type that could carry an error message alongside the failure?
- How would you test `getAuthorName`? Write out the test cases you'd need. How many of them involve null or undefined inputs?

Chapter five answers the first question: the distinction between `map` and `chain`, and when you need each. The second question leads into chapter six, where we look at Either.
