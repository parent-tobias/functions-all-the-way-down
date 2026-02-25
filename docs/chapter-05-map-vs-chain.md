# Functions All the Way Down: Chapter 5
## `map` vs `chain` — The Key Distinction

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

Once you understand `map` on Maybe, you'll quickly reach a moment where it doesn't quite work. The symptoms are unmistakable: you call `.map()` and instead of the value you expected, you get a `Just` wrapped inside another `Just`. Or you try to use the result and it doesn't behave like a plain value anymore.

This is the most common stumbling block when learning algebraic types, and the fix is straightforward once you understand the distinction. Chapter four introduced `map`; this chapter introduces `chain`, and the difference between them.

## What `map` Does

`map` applies a function to the value inside a container and wraps the result back in the same container type.

```js
Maybe.of(5).map(x => x * 2);
// Just(10)
```

The function `x => x * 2` takes a plain number and returns a plain number. `map` unwraps the `Just(5)`, applies the function, and wraps the result: `Just(10)`. Clean.

This is the contract: if you pass `map` a function that returns a plain value, you get back a wrapped value of the same type.

## The Problem

What happens if the function you pass to `map` also returns a Maybe?

```js
const safeDivide = (n) => (d) =>
  d === 0 ? Maybe.nothing() : Maybe.of(n / d);

Maybe.of(10).map(safeDivide(10));
// Just(Just(5))  ← nested — this is not what you want
```

`safeDivide(10)` returns a function that, given a denominator, returns a Maybe. When you map that over `Just(10)`, `map` does what it always does: unwraps the outer `Just`, applies the function (which produces `Just(5)`), and wraps the result. The result is `Just(Just(5))`.

You now have a Maybe nested inside a Maybe. Calling `.getOrElse(0)` on it gives you `Just(5)`, not `5`. You'd have to call `.getOrElse(0).getOrElse(0)` — and that tells you the nesting is wrong, not that you should call it twice.

## `chain` as the Solution

`chain` — also called `flatMap` or `bind` in other languages — is like `map` but flattens the result. Instead of wrapping the function's return value in a new container, it expects the function to return a container, and returns *that* container directly.

```js
Maybe.of(10).chain(safeDivide(10));
// Just(5)

Maybe.of(10).chain(safeDivide(0));
// Nothing
```

The implementation in `Just` reflects this exactly:

```js
const Just = x => ({
  map:   fn => Just(fn(x)),   // wrap the result
  chain: fn => fn(x),         // return the result directly (fn returns a Maybe)
  ...
});
```

`map` says "apply this function and wrap the result." `chain` says "apply this function and trust that it knows how to wrap its own result."

## The Mental Model

The simplest way to remember which to use:

- **`map`** is for functions that always succeed and return a plain value: `x => x * 2`, `s => s.toUpperCase()`, `item => item.title`.
- **`chain`** is for functions that might fail, or that already return a wrapped value: `safeDivide`, `getUser`, `parseJSON`.

If the function signature is `a -> b`, use `map`. If it's `a -> Maybe b` (or `a -> Either b`, or `a -> Task b`), use `chain`.

Another framing: if you ever find yourself with `Just(Just(...))` or `Right(Right(...))`, you reached for `map` when you needed `chain`.

## Why `Nothing` Makes `chain` Trivial

The beauty of the algebraic type design is that `Nothing` doesn't need to do anything special for `chain`:

```js
const Nothing = () => ({
  chain: fn => Nothing(),  // skip fn entirely, return Nothing
  ...
});
```

If you're chaining a sequence of operations and any of them returns `Nothing`, the `Nothing` propagates through the rest of the chain automatically. You don't have to check at each step. The type handles it.

```js
Maybe.of(item)
  .chain(i => Maybe.of(i.author))       // might be Nothing
  .map(authorToString)                   // skipped if Nothing
  .getOrElse('Unknown Author');         // fallback if Nothing
```

If `item.author` is null, `Maybe.of(i.author)` returns `Nothing`, and every subsequent operation is a no-op. `getOrElse` returns the fallback. You never check for null explicitly.

## A Concrete Example from the Project

The author normalization from chapter four illustrates both correctly:

```js
const authorToString = author =>
  typeof author === 'string' ? author : author?.name;

const getAuthorName = obj =>
  Maybe.of(firstOf('author', 'dc:creator')(obj))
    .map(authorToString)               // map: authorToString returns a string
    .getOrElse('Unknown Author');
```

`authorToString` returns a plain string, so `.map()` is correct. If it returned a Maybe — say, to handle the case where `author.name` itself might be null — you'd use `.chain()` instead:

```js
const authorToString = author =>
  typeof author === 'string'
    ? Maybe.of(author)
    : Maybe.of(author?.name);  // returns a Maybe

const getAuthorName = obj =>
  Maybe.of(firstOf('author', 'dc:creator')(obj))
    .chain(authorToString)     // chain: authorToString returns a Maybe
    .getOrElse('Unknown Author');
```

Both work. The choice between them is determined by what your function returns, not by preference.

## The Monad Laws (Don't Panic)

If you've heard "monad" thrown around and found it impenetrable, here's the practical version: a monad is just a container type that implements `of`, `map`, and `chain` following a few rules.

The rules (informally):
1. `chain(Maybe.of)` should give you back what you started with. Wrapping a value in `of` and immediately chaining shouldn't change anything.
2. `Maybe.of(x).chain(f)` should be the same as `f(x)`. Wrapping a value and then chaining should be the same as just calling the function directly.
3. Chaining should be associative: it shouldn't matter how you parenthesize a sequence of `chain` calls.

You don't need to memorize these. What they mean in practice is that the types behave consistently and predictably. `chain` doesn't have hidden behaviour depending on how many times you've called it or in what order. That consistency is what makes it safe to build pipelines with these types.

## A Few Things to Sit With

Before chapter six:

- We've handled null values with Maybe, but Maybe's `Nothing` carries no information — it just signals absence. What if the operation didn't just fail to produce a value, but failed for a *specific reason* — a null title, a missing link, an invalid format? How would you represent that failure in a way that lets you communicate the reason?
- `normalizeItem` in the current project needs to handle several potential failures. The item itself might be null. The title might be missing. The link might be missing. Each failure has a different message. Maybe's `Nothing` can't carry those messages — it's just absence. What type could?
- Consider the shape of `fold`, which we introduced briefly in the `normalizeItem` function. It takes two functions — one for each possible state. How is that different from `getOrElse`, and when would you want to handle both cases explicitly rather than providing a fallback?

Chapter six introduces Either, which is Maybe with memory — a container that carries an error message on the failure path and lets you handle both outcomes at the end.
