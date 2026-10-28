# Chapter 2: Currying and Partial Application — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

Recall → chapter 1's closing question: filterByTitle uses config => data => result; which other transforms benefit?

Why it matters → answer unclear until you consider how functions get used; purity helps in isolation, but this config/data split is what makes code compositional and pipeline-able.

Plan → go deeper on the pattern.

## The Difference Between Configuring and Running

Key distinction → filterByTitle('node') filters nothing yet; it creates a configured filter waiting for data; term = configuration, items = data.

> [Code: curried filterByTitle, then configuration step (findNodeNews) separated from later data step (applying it to feedItems)]

Config and data calls separable in time/space → configure once at startup, apply inside a request handler; this is partial application = some args upfront, rest deferred.

Contrast → imperative code either passes all args at once or stashes config in shared variables; partial application = third option: freeze config into a function and carry the function around.

Mechanism → closures: searchTerm captured by inner function, survives after outer returns; config lives inside the returned function, not externally; closures recur throughout the series.

## Building More Curried Transforms

Transition → apply the distinction to the rest of the transforms module.

Observation → RSS items filterable on more than title: categories, summary text; same shape.

> [Code: curried filterByCategory (categories/tags fallback) and filterBySummary (description/content fallback), both config => data => result]

Takeaway → both partially applicable, storable, composable; a startup-configured findJavaScriptArticles behaves as reliably as findNodeNews; identical shape, different config.

Aside → firstOf utility (try 'categories', fall back to 'tags') gets built in a later chapter; point now = curried structure enables composition regardless of internal complexity.

## Currying Isn't Just for Filtering

Generalization → pattern applies anywhere a value controls how a transformation behaves, not just filters.

Starting point → separate extractor per property works but doesn't scale.

> [Code: hand-written getTitles and getLinks, each mapping one hardcoded property]

Curried generalization:

> [Code: getProp (prop => item => item[prop]) and pluck (prop => items => map with getProp)]

Payoff → previous extractors become one-liners.

> [Code: getTitles = pluck('title'), getLinks = pluck('link')]

Reading → pluck('title') = "function that extracts title from each item in a list given later"; property locked in, data deferred; a dozen fields = twelve configured extractors from one general function.

## What "Higher-Order Functions" Actually Means

Term deflation → "higher-order function" sounds abstract but you've been writing them all along.

List → definition: a function that takes a function as argument and/or returns a function as result.

Application → every curried function here qualifies (pluck, filterByTitle return functions); partial application yields a function — a configured, specialized one.

Note → Array.prototype.map/filter are also higher-order (take a function, apply per element) → why curried functions compose naturally with array methods; pluck's output is exactly map's expected input shape.

## The Emerging Shape

Pattern spotting → look at the transforms module as a whole.

> [Code: module summary grouped by shape — extractors (pluck results), filters (config => items => result), sorters — all annotated by signature shape]

Split → functions divide by signature: extractors/sorters are items => result (ready now); filters are config => items => result (configure first → items => result out).

Why it matters → once configured, a filter is functionally identical to sortByDateDesc (items in, items out) → fits anywhere in a pipeline; chapter 3 exploits this with pipe.

## Updating the Tests

Housekeeping → new transforms need matching tests, same shape as chapter 1's.

> [Code: transforms.test.js additions — sample items mixing categories and tags fields; tests that filterByCategory matches by category and still finds the tags-only item]

Highlighted test → second test documents that categories/tags are handled transparently; tests on pure functions double as specifications.

## A Few Things to Sit With

Lead-in → questions before chapter 3.

List → (1) chaining items => result functions currently means nested calls read right-to-left, backwards from execution — cleaner expression? / (2) pipe is the answer and is built with reduce — see the connection: reduce threads a value through operations, same as threading data through functions / (3) a title-OR-summary search needs two predicates combined with OR logic — express as reusable utility instead of a hardcoded combined filter?

Next chapter → build pipe from scratch, show its reduce connection, refactor the transforms pipeline to read like a description of itself.
