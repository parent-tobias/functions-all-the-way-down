# Chapter 15: Composing Types — The Either → Task Bridge — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

/digest's pure core is tested and working (buildDigest: raw feed + normalized items → digest shape); Ch 14's open question: how to wire that core into an HTTP endpoint.

Two jobs: validate the request (does the URL parameter exist?) then fetch/process asynchronously if it does → validation is synchronous (Either), fetching is async (Task).

Problem: different types, can't .chain() across them directly → need a bridge.

## The Async Layer

processFeedForDigest follows processFeed's shape with one difference: it can't discard the raw feed object after extracting .items.

processFeed does this:

> [Code: processFeed excerpt — .chain(parseFeed).map(feed => feed.items), discarding the feed, then mapping normalizeItem]

Once mapped to feed.items the feed metadata (incl. title) is gone; buildDigest needs both → solution is a single .map() keeping both in scope:

> [Code: processFeedForDigest — one map over rawFeed that normalizes/filters items locally and returns buildDigest(rawFeed, sortByDateDesc(items))]

The local items variable gives buildDigest what it needs without losing the feed reference; the shape changed because the data dependency required it, not the style → rawFeed and items needed at the same moment, so they share a scope.

## The Naive Handler

Simplest handleDigestRequest follows the existing server.js pattern:

> [Code: naive handler — parse url param, if (!url) early-return sendError 400, else processFeedForDigest(url).fork(500 on err / 200 digest)]

It works: the if (!url) guard catches invalid and returns early, the Task handles valid — but there's a pattern break: an imperative conditional exits before the pipeline starts while the rest is declarative; the two styles sit side by side.

For a project demonstrating functional composition, that break is worth fixing.

## `fold` as a Bridge

Insight: fold converts an Either into whatever its two branches return — including a Task.

Either.fromNullable(url, 'Missing url parameter') → Right(url) or Left('Missing url parameter'); fold it with two Task constructors:

> [Code: Either.fromNullable(url, 'Missing url parameter').fold(Task.rejected, Task.of)]

Result: Task.rejected('Missing url parameter') or Task.of(url) — both Tasks; the Either is gone, leaving one Task carrying the error or the validated URL.

From there .chain(processFeedForDigest) sequences the async work and .fork() runs everything:

> [Code: full bridge chain — fromNullable → fold(Task.rejected, Task.of) → chain(processFeedForDigest) → fork(sendError 500 / sendJSON 200)]

One expression: validation, async processing, and response handling in a single chain → no early return, no conditional, no break between sync and async layers.

## Reading the Bridge

The bridge rewards close reading: the parameter order looks asymmetric:

> [Code: asymmetry annotation — fromNullable takes value first, error second; fold takes error first, value second]

fromNullable is the entry point, optimistic: the wanted thing is the primary argument, the error a fallback if it's absent.

fold is the exit: it forces handling both cases explicitly; error-first/value-second follows mathematical convention, fold(onLeft, onRight) → read it as fold(onError, onSuccess).

Different jobs → different orientations; internalise "entry is value-first, exit is error-first" and the asymmetry stops feeling wrong.

## The Tradeoff

Honest cost: the if-guard sent 400 for a missing parameter; the bridge collapses validation failure and fetch failure into the same fork error handler → 500 for both.

A missing URL parameter is a client error, a failed network request a server error → different HTTP semantics.

Distinction preservable by making error objects carry a status code from the start:

> [Code: status-carrying variant — Left({ status: 400, message }), fork destructures { status = 500, message } into sendError]

Caveat: only works if processFeedForDigest also rejects in the { status, message } shape — otherwise async errors arrive as plain Error objects and destructuring yields undefined → every rejection in the Task pipeline must be mapped to the shape before fork.

Cleanest mapping tool: a mapError method on Task, symmetric to map on the resolved value; this project's Task doesn't have one — could add it:

> [Code: mapError implementation — Task whose fork rejects with fn(err) and resolves unchanged]

Then the chain becomes:

> [Code: processFeedForDigest(url).mapError(err => ({ status: 500, message: err.message }))]

Worth-it depends on the project: 500 for a missing URL is a minor inaccuracy (server responded, just mislabelled); a production API wants the distinction, a learning project probably doesn't.

The tradeoff is visible precisely because the bridge made error paths explicit: both failures landing in one fork handler makes "do I need to distinguish them?" unavoidable.

## What the Pattern Gives You

The Either → Task bridge isn't exotic: a consequence of the same composability idea — containers with consistent interfaces, fold always the exit.

Fold-equivalents per type: Maybe → getOrElse (extract value or fall back to default); Either → fold (both paths handled, plain value produced); Task → fork (both paths handled, side effect triggered).

The bridge is fold used to produce a Task rather than a plain value: both branches return Tasks → you end up with a Task, and the rest is ordinary Task composition.

Underlying principle: fold produces whatever its functions return (strings → string, Tasks → Task) → the bridge isn't a special feature of Either or Task, it's what fold has always been.

## A Few Things to Sit With

Closing sit-with points: the application is complete in essentials as a functional reference, but the design space is worth sitting with — mapError discussed but unimplemented (what a full Task with mapError looks like, what patterns it unlocks); error values are inconsistent (strings vs Error instances) → a consistent { status, message } shape from origin would make the fork handler fully generic, at what enforcement cost; every container (Maybe, Either, Task) has map, chain, and an exit — that consistency is what makes the bridge possible, and the formalising specification is Fantasy Land, the source for why the pattern holds across containers.
