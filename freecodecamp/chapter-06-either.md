# Chapter 6: Either — Errors as Values — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

- Maybe → absence handled safely, no per-step checks; but Nothing = silent shrug, no reason why.
- Real validation wants the reason: title missing vs link null vs item undefined → useful for logging/debugging/user-facing errors; Nothing throws that away.
- Either keeps the reason.

## Right and Left

- Either = two constructors: Right (success value), Left (failure); naming = math convention, right = correct — just accept it.
- Right and Left share identical interfaces (like Just/Nothing); difference is behaviour only.

> [Code: either.js — Right/Left definitions with map/chain/filter/getOrElse/fold/inspect, plus Either.of and Either.fromNullable]

- Pattern identical to Maybe: Right applies/calls fn, Left ignores it → first failure wins, propagates unchanged through the chain.
- Difference from Maybe: Left carries a value → the error message/reason, extractable at the end.

## `fromNullable` with a Message

- Either.fromNullable ≈ Maybe.of + optional second arg = the Left value if first arg is null.

> [Code: Either.fromNullable on item.title with 'Title was null' → Right(title) or Left(message)]

- Point: front-load error messages — check once, convert to Either; downstream chain works on Right or propagates Left.

## `fold` as the Exit

- Every container has an exit: Maybe → getOrElse; Either → fold.
- fold takes two fns (Left case, Right case), applies the matching one, returns plain value — container gone.

> [Code: fold on Either.of(5) → 'Success: 5'; fold on fromNullable(null) → 'Error: Not found']

- Unlike getOrElse (Nothing path only), fold forces handling both cases — can't extract without deciding both outcomes; boundary principle: account for every outcome when leaving the functional world.

## Applying It: `normalizeItem`

- Where Either earns its place: RSS item normalization can fail several distinct ways (item null, title missing, link missing), each with its own message.

> [Code: normalizeItem — chained fromNullable checks for item/title/link, final map to shaped item, fold to {valid, error} or {valid, data}]

- Walkthrough: fromNullable wraps item → chain validates title (map spread to add it explicitly) → chain does same for link.
- Any Left → all later chain/map steps skipped, Left propagates unchanged → fold converts: Left → { valid: false, error }, Right → { valid: true, data }.
- Caller gets a plain object, no container → branch on result.valid, use result.data or log result.error.

## Railway Oriented Programming

- Mental model: two parallel tracks — success track and failure track; Right rides success, Left rides failure.
- Each chain/map = a switch on the success track only: success values pass through switches (may divert to failure track); failure-track values bypass every switch.
- fold = where the tracks merge at the end; fold decides based on which track you arrived on.
- Payoff: error propagation easy to reason about — errors always propagate forward once introduced, always handled explicitly at fold; no code-tracing needed.

## The Shape of the Result

- fold emitting { valid: false, error } / { valid: true, data } → callers never touch Either themselves, they get a plain result object; deliberate design.
- Functional core uses Either internally for propagation; boundary converts to consumer-friendly shape.

> [Code: processFeed pipeline — map normalizeItem over items, filter to valid, map to item.data]

- Normalize all → drop invalid → unwrap data; Either never escapes normalizeItem; pipeline sees plain objects only.

## A Few Things to Sit With

- Before chapter seven:
- Open questions to sit with: normalizeItem is pure/sync but fetching isn't — how to represent a not-yet-happened operation?; Promises are eager (start on creation) — can a future operation be represented un-started, configurable/composable without triggering?; Maybe (absence) vs Either (success/failure) vs future-value (not yet built) — all containers with map/chain, does the pattern hold for async?
- Next: chapter seven introduces Task — lazy container for async computation, same map/chain methods.
