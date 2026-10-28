# Chapter 12: Testing Algebraic Types — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

Plain-value testing is direct (array in, array out, assert contents); algebraic types wrap values → can't assert on a Just/Right directly, extract the value first.

Chapter covers Maybe/Either/fp-utils suites, the inspect()-as-assertion trap, and why extraction-first gives better tests.

## The Wrong Way: Testing `inspect()` Strings

inspect() is convenient in the console for seeing what a Maybe looks like:

> [Code: inspect() output strings for Just(5) and Nothing]

Tempting to use in tests:

> [Code: anti-pattern — asserting strictEqual on an inspect() string after map]

Works but fragile: tests the container's string representation, not the value → any inspect() format change (even a space) breaks every such test despite correct behaviour; you're testing a debugging utility's implementation detail.

Better approach: extract the value and assert on that.

## Testing Maybe: `getOrElse` as the Extractor

getOrElse = Maybe's extractor; pass a sentinel (a value that couldn't plausibly be a real result) → distinguish Just from Nothing without inspect().

> [Code: maybe.test.js — of/nothing constructors, map on Just and on Nothing, chain sequencing and short-circuit, all ending in getOrElse(sentinel)]

Every test ends .getOrElse(sentinel): Just → real value back, sentinel ignored; Nothing → sentinel, so the assertion passes iff Nothing was expected.

Ordering matters: constructors (of, nothing) tested before map/chain because later tests depend on constructor behaviour → failures easier to diagnose.

## Testing Either: `fold` as the Extractor

fold = Either's extractor, more expressive than getOrElse: both Left and Right handled explicitly.

> [Code: either.test.js — of/fromNullable/map/chain/filter/fold tests folding into { type, value } objects asserted with deepStrictEqual]

Fold-into-{type, value} pattern: one deepStrictEqual checks both which track and what value → a Right-vs-Left mismatch shows type and value together.

Simpler tests (filter, fold at the end): fold straight to a plain value when only one track is being checked.

## The First Two Tests Cover Two Things

Subtle point about the Either.of and fold tests; the very first test:

> [Code: first Either test — Either.of(5).fold(...) asserted deep-equal to the Right shape]

That test covers two things: Either.of creates a Right + fold dispatches the right function for a Right; too interdependent to gain from separating → any fold test catches a wrong Either.of; what matters is the tests exist and are precise.

## Tests as Formal Specifications

Behaviours the Either tests collectively document: of → Right; fromNullable(null) → Left with default message; fromNullable with custom message uses it; map transforms Right; map passes Left through unchanged; chain sequences Right operations; chain passes Left through unchanged; filter converts Right → Left when predicate fails; fold calls the appropriate function per case.

That's a complete behavioural specification: hand someone the test file and they could implement Either from scratch without reading the implementation → the mark of good tests.

## The Monad Laws, Made Testable

Ch 5 mentioned the monad laws informally; here they become concrete tests.

Left identity: Maybe.of(x).chain(f) should equal f(x).

> [Code: left identity test — both sides extracted with getOrElse and compared]

Right identity: m.chain(Maybe.of) should equal m.

> [Code: right identity test — chained result vs original, both via getOrElse]

Not needed in the suite to ship working software, but writing them cements why the types compose predictably; the laws hold by construction.

## Running the Full Suite

With the test files in place:

> [Code: npm test command]

Grouped describe output: a passing suite reads like documentation; a failure gives test name + assertion error → broken contract plus actual vs expected values.

> [Code: sample passing output — Maybe and Either describe groups with per-test checkmarks]

Eight files, zero mocks, zero dependencies beyond the standard library.

## A Few Things to Sit With

Sit-with questions: everything so far is test-after → what changes test-first, natural for which functions, forced for which; task.test.js forks immediately-settling in-memory Tasks → what processFeed testing needs beyond that, where unit testing a Task ends and integration begins; tests document current behaviour → renaming normalizeItem's error key breaks several tests, good or bad?

Ch 13 preview: closes the testing part — steps back from mechanics to when TDD makes sense in an FP codebase, the discipline in practice, and what good coverage means for code shaped like this.
