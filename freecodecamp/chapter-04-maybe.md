# Chapter 4: Maybe — Safe Null Handling — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

Opening → Tony Hoare's "billion-dollar mistake" quote on inventing the null reference; null is contagious — propagates up call stacks past transformations that assumed a value.

Local version → RSS authors: sometimes present, sometimes absent, sometimes string, sometimes object with name property; careless getAuthorName → crashes on missing data or null checks scattered until the transformation is unrecognizable.

Hook → a better approach exists.

## The Problem with Defensive Null Checks

Setup → the naive getAuthorName:

> [Code: naive getAuthorName — guard clauses over author/dc:creator, typeof string check, name property check, 'Unknown Author' fallbacks]

Critique → works, but every line asks "do I have a value?"; actual logic (author.name) buried in conditionals; real pipelines accumulate this, each check a place to forget or check wrongly.

Inversion → don't check before each operation; wrap the possibly-absent value once and let the wrapper do the checking.

## Just and Nothing

Design → Maybe built from two constructors: Just (holds a value) and Nothing (holds absence); identical interfaces, different behaviour.

> [Code: src/lib/maybe.js — Just and Nothing with map/chain/filter/getOrElse/inspect, plus Maybe.of null-checking constructor and Maybe.nothing]

Encapsulation note → Just's value isn't a property on the object (no maybe.value); reachable only via methods closing over it — chapter 2's closure mechanism applied to a data structure: currying froze config into functions, Just seals a value into a container that controls all access.

Symmetry payoff → both constructors expose map/chain/filter/getOrElse → calling code never asks which it holds; Just runs the function and re-wraps, Nothing skips it and propagates absence automatically.

## Walking Through It

Demo intro → Maybe in use:

> [Code: Maybe.of('hello') chained through two maps (uppercase, append '!') then getOrElse — result 'HELLO!']

Null case:

> [Code: same chain starting from Maybe.of(null) — both maps skipped, getOrElse returns the fallback 'nothing there']

Comparison → identical code in both chains (two maps, one getOrElse); only difference is what Maybe.of produced — Just vs Nothing; from then on, same methods, container handles it.

Exit point → getOrElse extracts the plain value with a fallback for Nothing; called at the end, where a plain value is actually needed → defaults declared at the boundary instead of || 'Unknown' sprinkled throughout.

## Applying It: Author Normalization

Claim → Maybe cleans up getAuthorName:

> [Code: getAuthorName via Maybe.of(firstOf('author', 'dc:creator')) → map authorToString → filter out undefined → getOrElse('Unknown Author')]

Walkthrough → firstOf tries author then dc:creator; Maybe.of wraps (Nothing if both missing); map converts to string only if present; one leak remains — author object without name converts to undefined, a Just holding nothing worthwhile; filter drops exactly that case to Nothing; getOrElse extracts or falls back.

Verdict → four lines, zero conditionals; "try fields, convert, default" reads in sequence.

## `Maybe.of` as the Smart Constructor

Front-loading → Maybe.of is the single null/undefined check; after wrapping, every map is safe because you operate on the container, not the raw value; transformation functions never check internally.

Principle → validate at the boundary, operate confidently inside; once wrapped, treat the value as a Maybe and let the type handle absence.

of vs Just → separate on purpose: Maybe.of inspects and picks the right container (safe); Just assumes a value already exists — using Just directly means you checked, Maybe.of means the type checks.

## What `filter` Does

Addition → Just and Nothing also implement filter, behaving as expected.

> [Code: Maybe.of(5).filter(x => x > 10).getOrElse(0) — predicate fails, 5 becomes Nothing, result 0]

Use → predicate false turns Just into Nothing → "have a value, care only if it meets a condition" expressed in the same chain without breaking out.

## A Few Things to Sit With

Lead-in → before moving on.

List → (1) what if a transformation itself returns a Maybe (e.g. a function returning Maybe.of(something)) — what does map give you then? / (2) absence isn't the only failure — what if you need to know why something failed? Nothing carries no information; is there a type that carries an error message with the failure? / (3) how would you test getAuthorName — list the cases; how many involve null/undefined inputs?

Next chapters → chapter 5 answers question 1 (map vs chain); question 2 leads to Either in chapter 6.
