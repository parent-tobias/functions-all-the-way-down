# Chapter 17: Collecting Failures — The Validation Type — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

Note: series line — part of "Functions All the Way Down: Building an API using Functional Programming".

Note: Ch. 16 ended on a question → Either short-circuits, first Left wins + everything after skipped; exactly right when a missing URL param should abort the request, but validating all fields of a feed item (title null AND link null) wants both errors, not just the first.

Note: Either can't do that → something different needed.

## What Either Can't Do

Note: `normalizeItem` validates a feed item with Either → run it on an item with neither title nor link →

> [Code: normalizeItem on an item missing title and link, returning only 'Title was null']

Note: title null → chain stops, link never checked → one error back despite two existing.

Note: fine for the feed pipeline → malformed item gets filtered out, no need to know exactly how malformed.

Note: but for a data quality report or debugging surface → first failure only is less useful than all of them; need a type that *keeps going* after an error.

## Success and Failure

Note: Validation looks like Either (two variants, two rails) but behaves differently →

> [Code: the Success and Failure definitions — map, ap, fold, isFailure]

Note: two differences from Either stand out immediately.

Note: first difference → `Failure` holds an *array* of errors, not one → prerequisite for accumulation, somewhere to put multiple values.

Note: second difference → no `chain`, instead `ap` → chain is for *dependent* operations (output feeds next input), ap is for *independent* ones (validating title has nothing to do with validating link); results evaluated separately, then combined.

## `ap` and What It Does

Note: `ap` = short for *apply* → put a function inside a `Success`, apply it to values held in other Validations.

Note: `Success(fn).ap(Success(x))` → applies fn to x → `Success(fn(x))`.

Note: if either side is a `Failure` → errors accumulate →

> [Code: three ap cases — Success over Failure, Failure over Success, Failure over Failure concatenating both error arrays]

Note: the last case is the one that matters → two independent failures combined into one; neither short-circuits, both collected.

Note: honest detail on direction → here the *function* container receives the `ap` call and the *value* container is the argument; Fantasy Land orders it the other way (ap called on value's container, passed the function's); behaviour identical, only reading direction differs → function-first kept because it makes the curried-constructor pattern below read left to right, but expect the mirror image when comparing against the spec.

## Validators

Note: Either style → `normalizeItem` validates fields inside a `chain`; Validation style → small, focused validator functions →

> [Code: validateHasTitle and validateHasLink — one check each, Success(value) or Failure([message])]

Note: each validator takes a single value, not the whole item → check one thing, return Success with the value or Failure with the message in an array.

## Composing Validators with `ap`

Note: the pattern needs a shift in thinking → worth slowing down for.

Note: map/chain start with a *value* and thread it through functions; ap starts with a *function* and threads it through values →

> [Code: contrast — Either chain starting from a value vs Success holding a curried function applied via ap]

Note: the part that trips people up → **the first `Success` must hold a function, not a value**; `Success(item).ap(...)` tells ap that `item` is the function to apply → fails immediately, item is a data object.

Note: the curried function `title => link => item` is what connects the validations →

> [Code: validateItem — Success(curried fn) .ap(validateHasTitle) .ap(validateHasLink) .fold to a plain result object]

Note: step through a successful case →

Note: success trace, compressed → Success holds the two-arg curried fn; first ap maps it over the title → partially applied Success still waiting for arg two; second ap maps it over the link → fully applied Success(item); fold → `{ valid: true, data: item }`.

Note: each `.ap()` consumes one argument of the curried function → after the first, a partially-applied function waiting on its second argument; after the second, function complete + Success holds the final value.

Note: now trace the failing case → both fields missing →

Note: failure trace, compressed → ap over Failure(['Missing title']) → Failure.map ignores the function → still Failure(['Missing title']); next ap called on that Failure against Failure(['Missing link']) → error arrays concatenate → Failure(['Missing title', 'Missing link']); fold → `{ valid: false, errors: [...] }` with both.

Note: both failures collected, neither stopped the chain → the function in the initial Success never gets applied (discarded once the first Failure takes that rail), but error accumulation continues regardless.

Note: one more detail → the curried function `title => link => item` ignores both its arguments; `item` already lives in the outer closure so the function just returns it; validated title/link serve only as evidence the fields exist → a more complex case could build the result *from* the validated fields (`title => link => ({ ...item, title, link })`), but here presence matters, not the values.

## Either vs Validation, Side by Side

Note: both functions tested against the same inputs →

> [Code: normalizeItem vs validateItem on the same input — one error vs both errors]

Note: neither is better → different jobs; Either's fail-fast is correct for the processing pipeline (no detailed report needed on a filtered item), Validation's accumulation is correct when you need everything that's wrong.

Note: which type to reach for depends on what the calling code needs to do with the result.

## The Fold at the Boundary

Note: `validateItem` ends with a `.fold()` → same principle as normalizeItem and the server's Task pipelines; Validation is an implementation detail, the function's public contract is a plain object: `{ valid, data }` or `{ valid, errors }`.

Note: calling code never imports Success/Failure → it receives the plain object, reads `valid`, decides what to do; the type does its work inside the function and exits before the boundary.

## A Name for the Pattern

Note: `ap` belongs to the *Applicative* pattern → applying a wrapped function to a wrapped value; the related pattern used all along: `map` applies a *plain* function to a wrapped value; ap extends that to functions themselves wrapped in a container.

Note: the name → `ap` is short for *apply*, specifically applicative apply; written `<*>` in some languages/specs; the Fantasy Land specification (formalises algebraic structures for JS) calls it `ap`.

Note: no need to internalise the terms to use the pattern → but if met elsewhere: Functor = anything with `map`, Applicative = anything with `ap`; every type in this series has been a Functor, Validation is the first Applicative.

## A Few Things to Sit With

Note: before chapter eighteen →

Note: questions to sit with → validateItem closes over the outer item and its curried function ignores its arguments — what changes if the success value must be built *from* the validated fields, and would the validators themselves need to change?; Validation has no `chain` — could one be added, what would it need to do, and why might it defeat the point of accumulating errors?; every type so far (Maybe, Either, Task, Validation) has a `fold` that exits the type into a plain value — what does that pattern suggest about how algebraic types should relate to the rest of the code?

Note: Ch. 18 preview → introduces the IO monad: the same describe-first, execute-at-boundary principle as Task, applied to synchronous side effects.
