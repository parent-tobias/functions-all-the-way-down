# Functions All the Way Down: Chapter 17
## Collecting Failures — The Validation Type

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

Chapter 16 ended with a question: Either short-circuits — the first Left wins and every subsequent operation is skipped. That's exactly what you want when a missing URL parameter should abort the request immediately. But what about validating all the fields of a feed item? If title is null and link is null, you'd like to know both of those things, not just the first.

Either can't do that. You need something different.

## What Either Can't Do

`normalizeItem` validates a feed item using Either. Run it against an item with neither a title nor a link:

```js
normalizeItem({ pubDate: '2024-01-01' })
// { valid: false, error: 'Title was null' }
```

Title is null, so the chain stops. Link is never checked. You get one error back, even though there were two.

For the feed processing pipeline this is fine — if an item is malformed, you filter it out and move on. You don't need to know exactly how malformed it is.

But suppose you're building a data quality report, or surfacing validation errors for debugging. In that context, knowing only the first failure is less useful than knowing all of them. You need a type that *keeps going* even when it finds an error.

## Success and Failure

The Validation type looks like Either — two variants, two rails — but behaves differently:

```js
export const Success = value => ({
  map:  fn => Success(fn(value)),
  ap:   other => other.map(value),
  fold: (failFn, successFn) => successFn(value),
  isFailure: false,
});

export const Failure = errors => ({
  map:  fn => Failure(errors),
  ap:   other => other.isFailure
    ? Failure(errors.concat(other.errors))
    : Failure(errors),
  fold: (failFn, successFn) => failFn(errors),
  isFailure: true,
  errors,
});
```

Two differences from Either stand out immediately.

First: `Failure` holds an *array* of errors, not a single error. That's the prerequisite for accumulation — you need somewhere to put multiple values.

Second: there is no `chain`. Instead there is `ap`. `chain` is for *dependent* operations — the output of one feeds into the input of the next. `ap` is for *independent* operations — validating the title has nothing to do with validating the link. Their results can be evaluated separately and combined.

## `ap` and What It Does

`ap` is short for *apply*. The pattern: you put a function inside a `Success`, then apply it to values in other Validations.

`Success(fn).ap(Success(x))` applies `fn` to `x`, producing `Success(fn(x))`.

If either side is a `Failure`, errors accumulate:

```js
Success(fn).ap(Failure(['error']))         // → Failure(['error'])
Failure(['error']).ap(Success(x))          // → Failure(['error'])
Failure(['e1']).ap(Failure(['e2']))         // → Failure(['e1', 'e2'])
```

The last case is the one that matters: two independent failures, combined into one. Neither short-circuits. Both are collected.

## Validators

With Either, `normalizeItem` validates fields inside a `chain`. With Validation, you write small, focused validator functions:

```js
export const validateHasTitle = title =>
  title ? Success(title) : Failure(['Missing title']);

export const validateHasLink = link =>
  link ? Success(link) : Failure(['Missing link']);
```

Each validator takes a single value — not the whole item. Its job is simple: check one thing, return a `Success` with the value or a `Failure` with a message in an array.

## Composing Validators with `ap`

Here's where the pattern requires a shift in thinking that's worth slowing down for.

With `map` and `chain`, you start with a *value* and thread it through functions. With `ap`, you start with a *function* and thread it through values:

```js
// map/chain: start with a value, apply functions to it
Either.fromNullable(url)
  .chain(fetchFeed)
  .map(normalizeItems)

// ap: start with a function, apply it to validated values
Success(title => link => item)
  .ap(validateHasTitle(item.title))
  .ap(validateHasLink(item.link))
```

This is the part that trips people up: **the first `Success` must hold a function, not a value**. If you write `Success(item).ap(...)`, you're telling `ap` that `item` is the function to apply — which will fail immediately, because `item` is a data object.

The curried function `title => link => item` is what connects the validations:

```js
export const validateItem = item =>
  Success(title => link => item)
    .ap(validateHasTitle(item.title))
    .ap(validateHasLink(item.link))
    .fold(
      errors => ({ valid: false, errors }),
      item   => ({ valid: true,  data: item })
    );
```

Step through a successful case:

1. `Success(title => link => item)` — a Success holding a two-argument curried function
2. `.ap(Success('My Title'))` — `ap` calls `other.map(fn)` where `fn` is `title => link => item`; maps it over `'My Title'` → `Success(link => item)` — the function has been *partially applied*; it's now waiting for its second argument
3. `.ap(Success('https://...'))` — `ap` calls `other.map(fn)` where `fn` is now `link => item`; maps it over the URL → `Success(item)` — fully applied
4. `.fold(...)` → `{ valid: true, data: item }`

Each `.ap()` call consumes one argument of the curried function. After the first, you have a partially-applied function still waiting for its second argument. After the second, the function is complete and the Success holds the final value.

Now trace a failing case — both fields missing:

1. `Success(title => link => item)`
2. `.ap(Failure(['Missing title']))` — `ap` calls `other.map(fn)`; `Failure.map` ignores the function entirely → `Failure(['Missing title'])`
3. `.ap(Failure(['Missing link']))` — we're now calling `Failure.ap(Failure(...))`, which concatenates the error arrays → `Failure(['Missing title', 'Missing link'])`
4. `.fold(...)` → `{ valid: false, errors: ['Missing title', 'Missing link'] }`

Both failures were collected. Neither stopped the chain. The function in the initial `Success` was never applied — it's discarded once the first `Failure` takes over that rail — but the error accumulation continues regardless.

One more thing worth noting: the curried function `title => link => item` ignores both its arguments. `item` is already available in the outer closure, so the function just returns it directly. The title and link values from the validators serve only as evidence that those fields exist; the function doesn't need to use them to build the result. For a more complex case, you could build the result *from* the validated fields — `title => link => ({ ...item, title, link })` — but here, presence is what matters, not the values themselves.

## Either vs Validation, Side by Side

Both functions are tested against the same inputs:

```js
normalizeItem({ pubDate: '2024-01-01' })
// { valid: false, error: 'Title was null' }
// Stopped at the first failure.

validateItem({ pubDate: '2024-01-01' })
// { valid: false, errors: ['Missing title', 'Missing link'] }
// Collected every failure.
```

Neither function is better — they have different jobs. Either's fail-fast behaviour is correct for the processing pipeline: you don't need a detailed report of why an item was filtered out. Validation's accumulating behaviour is correct when you need to know everything that's wrong.

The type you reach for depends on what the calling code needs to do with the result.

## The Fold at the Boundary

`validateItem` ends with a `.fold()` — the same principle as `normalizeItem` and the Task pipelines in the server. The Validation type is an implementation detail. The function's public contract is a plain object: `{ valid, data }` or `{ valid, errors }`.

Calling code doesn't import `Success` or `Failure`. It receives a plain object and reads `valid` to decide what to do next. The type does its work inside the function and exits before the boundary.

## A Name for the Pattern

The `ap` method is part of what's called the *Applicative* pattern — applying a wrapped function to a wrapped value. You've been using a related pattern all along: `map` applies a plain function to a wrapped value. `ap` extends that to functions that are themselves wrapped in a container.

The name `ap` comes from this: it's short for *apply*, specifically *applicative apply*. In some languages and specifications you'll see it written as `<*>`. The Fantasy Land specification — which formalises algebraic structures for JavaScript — calls it `ap`.

You don't need to internalise those terms to use the pattern. But if you encounter "Functor" or "Applicative" elsewhere: a Functor is anything with `map`, and an Applicative is anything with `ap`. Every type in this series has been a Functor. Validation is the first Applicative.

## A Few Things to Sit With

Before chapter eighteen:

- `validateItem` closes over the outer `item` and the curried function ignores its arguments. What would change if you wanted the success value built *from* the validated fields — if `title` and `link` were actually used rather than discarded? Would the validators need to change?
- The Validation type here has no `chain`. Could you add one? What would it need to do — and why might it defeat the purpose of accumulating errors?
- Every type in this series — Maybe, Either, Task, Validation — has a `fold` that exits the type and returns a plain value. What does that pattern suggest about how algebraic types should relate to the rest of your code?

Chapter eighteen introduces the IO monad — the same describe-first, execute-at-boundary principle as Task, applied to synchronous side effects.
