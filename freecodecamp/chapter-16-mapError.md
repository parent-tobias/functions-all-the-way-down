# Chapter 16: Completing Task — `mapError` and Consistent Error Shapes — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

Note: series line — part of "Functions All the Way Down: Building an API using Functional Programming".

Note: Ch. 15 recap → Either→Task bridge collapsed two error types (missing URL param = client mistake/400, failed feed fetch = server failure/500) into one fork handler sending 500 for both; problem named + solution sketched last chapter, implementation left to this one.

Note: the fix = `mapError` → one method, one line, completes the symmetry Task was missing.

## The Gap in Task

Note: look at what Task already has →

> [Code: Task's existing map, chain, and fold definitions]

Note: every existing method works the resolved path only → map transforms resolved value, chain sequences resolved values into new Tasks, fold routes both paths to resolve; rejected path only passed through unchanged or consumed by fork.

Note: gap = no method transforms the rejected value without terminating the Task → `mapError` fills it →

> [Code: the mapError definition]

Note: set it beside `map` → symmetry complete →

> [Code: map and mapError side by side, aligned]

Note: map transforms resolved value + passes rejection through; mapError transforms rejected value + passes resolution through; neither terminates the Task, both return a new composable Task.

## The Error Shape Problem

Note: mapError only useful if errors reaching fork share a consistent shape → in the original server they didn't.

Note: the two inconsistent shapes → `Either.fromNullable` produced a plain string Left ('Missing url parameter'); `processFeed` rejected with a plain `Error` object needing `.message`.

Note: fork's error handler needed to know which kind of error it got → but that context was already gone by arrival.

Note: fix needs two things → agree on an error shape + make every error path produce it before fork.

Note: the shape = `{ status, message }` → status code + human-readable message, decided in the HTTP shell where status codes belong →

> [Code: shaped 400 error in the Either Left, and the mapError normaliser line producing the 500 shape]

Note: honest detail the whole fix hangs on → validation error does NOT bypass mapError, the bridge already turned the Left into a rejected Task before mapError in the chain, so `{ status: 400, … }` flows through mapError too; a normaliser rewriting every rejection as 500 would undo the validation at the last step → so the normaliser is selective: numeric `status` already present → pass through unchanged; anything else (plain Errors from fetch/parse) → normalise to the 500 shape; mapError normalises *unshaped* errors, doesn't overwrite decisions the shell already made → both paths arrive at fork uniform, fork destructures with no conditionals →

> [Code: fork destructuring { status, message } straight into sendError / sendJSON]

## Why the Error Shape Lives in the Shell

Note: fair objection → does `{ status: 400 }` in an Either Left mix HTTP concerns into a general-purpose type?

Note: Either itself unaffected → holds whatever goes in the Left, same as always; real question = is the *calling code* coupling the wrong things?

Note: answer turns on where you are → in the functional core (transforms.js, digest.js) errors carry semantic meaning ('Title was null', 'Items array is empty'); that code has no business knowing it serves HTTP.

Note: but `handleFeedRequest` *is* HTTP code, in the shell by design → `{ status: 400 }` in the Left there isn't a leak, it's the right layer making the right decision; the shell is exactly where HTTP codes belong.

Note: bigger app → semantic error types through the core + one translation layer at the boundary; for this project the pragmatic choice is correct → decide the shape at the HTTP entry point, normalise everything else to match via mapError.

## `Either.of` vs `Either.fromNullable`

Note: `/feeds` handler exposes a subtle choice → `searchParams.getAll('url')` always returns an array, never null/undefined, so `Either.fromNullable`'s null check can never trigger; the validation actually needed = is the array non-empty? →

> [Code: Either.of(urls) + filter on length > 0 with the 400 error shape, folded into a Task]

Note: `Either.of` wraps the value in a Right unchecked (array known to exist); `filter` applies the real condition → empty array switches Right to Left with the error shape, non-empty passes through unchanged.

Note: fromNullable vs filter, each for its actual job → fromNullable for values that might be absent, filter for values that exist but might fail a condition; right tool makes intent readable ("have an array; require ≥ 1 element").

## The Result

Note: three handlers, all following the same pattern →

> [Code: all three handlers — /feed, /feeds, /digest — each validate → bridge → chain → mapError → fork]

Note: fork error handlers now identical across all three routes → not coincidence, it's what consistent error shapes buy; shell reads as one uniform pattern: validate, bridge to Task, process, normalise errors, respond.

## On Testing the Shell

Note: no `server.test.js` exists → deliberate, not an oversight.

Note: server.js holds no logic, only wiring → every decision it delegates to is already tested (algebraic types have own suites, pure transforms tested, processFeed + siblings covered indirectly); shell's correctness follows from correctness of what it connects.

Note: testing the shell properly = mocking req/res (harder to trust than the code under test) or integration tests against a real HTTP server → integration tests valuable but their own topic; on a core-focused project they'd add more ceremony than signal.

## A Few Things to Sit With

Note: before chapter seventeen →

Note: questions to sit with → mapError transforms one error in a pipeline, but what about validation producing *multiple* errors at once (normalizeItem stops at first missing field — what if all failures were collected together?); Either short-circuits (first Left wins, rest skipped) — right for fail-fast, wrong for form/field validation where you want everything that's wrong — is there a type that accumulates instead?; if two errors can both be Lefts, how would you combine them — what operation does that require and how does it differ from `chain`?

Note: Ch. 17 preview → introduces Validation, an Either variant that collects failures instead of stopping at the first one, + the Applicative pattern that makes combining independent results possible.
