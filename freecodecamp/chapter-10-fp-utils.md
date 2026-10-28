# Chapter 10: Utility Libraries and Reusability — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

- Recurring patterns across the project: config => data => result shape in every filter; trying several field names in order (normalizeItem, filterByCategory, filterBySummary); conditionally applying a transformation (processFeed).
- Rule of thumb: pattern in domain code → leave it; same pattern in unrelated parts of domain code → move it to a shared utility module with no domain knowledge.
- That module = fp-utils.js; walkthrough follows.

## `pipe` and `compose`

- Built in chapter three; the foundational composition tools.

> [Code: compose (reduceRight) and pipe (reduce) definitions]

- Both domain-agnostic — nothing about RSS feeds/items/data; mathematical operations on functions; belong in utilities precisely because any FP codebase wants them.

## `getProp` and `pluck`

> [Code: getProp (curried property accessor) and pluck (map getProp over an array)]

- getProp = curried accessor: property name → fn extracting it from an object; pluck extends it across an array.
- Named utilities exist for reuse: pluck('title') is getTitles, pluck('link') is getLinks; need pubDate extraction later → already have it; domain functions become declarations, not implementations.

> [Code: getTitles = pluck('title') and getLinks = pluck('link')]

- One-liners = sign they're correctly abstracted.

## `firstOf` — The Coalesce Pattern

> [Code: firstOf — try keys in order, return first value where v != null]

- firstOf tries a list of property names on an object → first non-null value; handles RSS reality: different parsers/standards use different fields for the same data.
- Field variance examples: description vs content, categories vs tags, author vs dc:creator; instead of conditional logic each time, firstOf states the intent directly.

> [Code: firstOf in use — summary from description/content with fallback string, categories from categories/tags with [], author from author/dc:creator]

- Detail: uses v != null (loose), not v !== null — loose check catches both null and undefined (missing vs explicitly null); one of the few places loose equality is the right choice in modern JS.

## `identity`

> [Code: identity = x => x]

- identity returns whatever it receives, unchanged; sounds useless until a no-op is needed in a higher-order context.
- Uses: default transformation when none specified (does nothing); pass-through in fold for the Left or Right value without modification.
- Testing note: may skip testing it as obvious — but the point is having it named rather than writing x => x inline everywhere; named identity is self-documenting, anonymous x => x makes the reader ask why it exists.

## `when` — Conditional Application

> [Code: when — returns fn if condition truthy, identity otherwise]

- when returns fn or identity based on condition → conditional pipeline steps stay readable:

> [Code: processFeed with options — .map(when(category, filterByCategory(category))) and .map(when(search, filterBySearch(search))) before sortByDateDesc]

- Those last two .map() calls apply filters only if the params were provided; without when you'd break out of the pipeline:

> [Code: imperative alternative — await fetchAndProcess, then if (category) / if (search) reassignments outside the pipeline]

- That works but is imperative and interrupts pipeline flow; when keeps conditional logic inside the composition without branching.
- Key insight: when(category, filterByCategory(category)) evaluates to a function either way (the filter or identity) → .map() always receives a function, pipeline continues uninterrupted.

## `anyPass` — Predicate Combination

> [Code: anyPass — combine predicates into one that passes if any predicate passes (some)]

- anyPass = multiple predicates → new predicate passing if any original passes; logical OR for predicates.
- In the project it appears in matchesSearch:

> [Code: matchesSearch built with anyPass over title-includes and summary-includes predicates]

- Equivalent inline version:

> [Code: matchesSearch rewritten with plain || between title and summary includes checks]

- Honest assessment: anyPass version is more verbose here — inline probably cleaner for this case; anyPass pays off with many predicates, config-supplied predicates, or expressing the combination separately from its application point:

> [Code: isNewsworthy = anyPass(isBreakingNews, isTrending, isFromTrustedSource), used as items.filter(isNewsworthy)]

- Named predicate combinations → readable domain concepts instead of inline boolean expressions.

## The Vocabulary

- Taken together, fp-utils.js gives the project a vocabulary for expressing data transformations:
- Vocabulary list: pipe/compose (sequence functions), pluck (extract a field from each list item), firstOf (try field names in preference order), identity (pass through unchanged), when (conditionally apply a transform), anyPass (combine predicates with OR).
- None of these know anything about RSS feeds; none would be out of place in a completely different codebase; vocabulary for computing with values, not processing feeds.
- Well-designed utility library = small, focused, domain-agnostic functions expressing common computational patterns; domain code uses them as building blocks, utilities have no domain knowledge.
- Ramda / Lodash/fp familiarity: much here will look familiar — difference is these were built from scratch, so you know exactly what they do and why; appendix points to Ramda as the most direct production comparison.

## A Few Things to Sit With

- Before the testing chapters:
- Open questions to sit with: fp-utils.js has no tests yet — which utilities benefit most from explicit tests, which are simple enough that tests would be noise?; firstOf edge cases — called with no keys? no keys present on the object? behaviours worth documenting with tests?; when returns a function or identity — what does when(false, filterByTitle('node')) return vs when(true, ...)? — do those mental tests capture the intended behaviour completely?
- Next: chapters eleven and twelve are the testing chapters (eleven = pure functions, twelve = algebraic types); fp-utils.js returns in twelve for proper utility tests.
