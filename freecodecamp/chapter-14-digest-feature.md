# Chapter 14: Putting It Together — Building the /digest Feature — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

First thirteen chapters built the tools: pure functions, currying, pipe, Maybe, Either, Task, Task.all, functional core / imperative shell, testing → what follows is using them.

A new feature is the best review of a design: sound design → adding feels natural, types compose without fighting, architecture says where pieces belong, time goes to the problem not the plumbing.

/digest endpoint = feed summary: item count, date range covered, most common categories, a handful of recent headlines → concrete enough to be simple, complex enough to exercise the full stack.

## Designing Before Coding

Before any code: sketch the shape of the problem.

Digest has five fields: four are transformations of the normalized items (count = items.length, recent headlines = slice of sorted items mapped through toHeadline, top categories = frequency count, date range = first/last item); the fifth, feedTitle, comes from the raw feed object, not the items.

Signature consequence: buildDigest needs both the raw feed (metadata) and the normalized items (derived stats) → can't discard the feed after extracting .items the way processFeed does, the title is still needed.

The full digest shape:

> [Code: digest object literal — feedTitle, itemCount, dateRange {newest, oldest}, topCategories, recentItems]

Shape clear → design the pure functions before writing any of them.

## Where Does the Code Live?

transforms.js = shared library across routes; getDateRange/topCategories/buildDigest are digest-specific, unreused, and encode /digest decisions.

Natural home: route-named file src/digest.js → route growth (e.g. ?count=10 for recent-item count) stays co-located; route-specific transforms in route files, shared transforms in transforms.js.

Small organisational decision, pays off as the project grows: immediately know where to look and what's shared vs owned.

## Maybe vs Either: Choosing the Right Type

getDateRange must handle an empty feed: no items → no date range to report; how should it communicate that?

Key question: is the absent date range an error, or just what an empty feed means?

Empty feed isn't a bug or validation failure — a legitimate state the caller handles gracefully (omit the field, render "no items"); the absence carries no message, reason, or culpability → just absent.

That's Maybe:

> [Code: getDateRange — empty array → Maybe.nothing(), else Maybe.of({ newest: first pubDate, oldest: last pubDate })]

Contrast normalizeItem (Either): a missing title is an error — malformed item, and the message ('Title was null') is useful debugging info → Either carries it in a Left; Nothing is silent.

Rule of thumb: Maybe for absence without judgment; Either for failure with a reason.

getDateRange([]).getOrElse(null) in buildDigest = "no range → null, no explanation needed"; the caller decides what null means in context.

## Currying for Configuration

topCategories needs configuration (how many to return) and must stay a plain items → result function droppable into any pipeline.

Currying solves both:

> [Code: curried topCategories(n)(items) — flatMap categories, frequency-count reduce, sort desc, slice n, map to names — plus top5Categories = topCategories(5)]

topCategories(5) = configured items → [string] function: pass to .map(), compose with pipe, or store as top5Categories; the 5 is baked in, the function ready for any items.

Ch 2 pattern in practice: currying = configure behaviour once, apply many times, configuration untangled from the data.

## Assembling the Digest

buildDigest straightforward once the helpers exist:

> [Code: buildDigest(rawFeed, items) — object assembling feedTitle, itemCount, dateRange, topCategories, recentItems from the helpers]

Maybe.of(rawFeed.title).getOrElse('Untitled Feed') handles a missing feed title gracefully; getOrElse(null) on getDateRange converts Nothing → null for JSON; everything else is a direct transformation.

No conditionals, early returns, or null checks: each field is an expression producing a value or falling back to a default.

## Testing First

Digest's pure core fully testable before any async exists: getDateRange array → Maybe, topCategories number + items → strings, buildDigest objects → object; no network, mocks, or test infrastructure.

Tests first reveal the contract clearly:

> [Code: getDateRange tests — empty array → null via getOrElse; non-empty sample → { newest, oldest } object]

Empty-array test asserts on getOrElse(null)'s result, not on "is Nothing" directly → behaviour tested from outside, variant is implementation detail; refactoring getDateRange to return null directly still passes → right abstraction level.

topCategories subtlety: tied frequencies can come out in any order → asserting exact positions of tied entries is brittle; use .includes('Node')/.includes('JavaScript') instead of deepStrictEqual on the full array; the contract guarantees frequency ranking, tie order is an implementation detail.

## A Few Things to Sit With

Sit-with questions: buildDigest's pure functions are tested but nothing runs — the feature needs a Task that fetches the feed and keeps raw metadata alongside normalized items, unlike processFeed discarding the feed after .items; the /feed and /feeds handlers guard with imperative if (!url) return sendError(...) before the Task pipeline — works but breaks pipeline style → how would Either.fromNullable validation chain into the processing Task; the answer converts an Either into a Task where sync validation hands off to async — what that conversion looks like and what the single-expression handler reveals about the problem's shape.

Ch 15 preview: wires up the async layer + the Either → Task bridge pattern in a single pipeline.
