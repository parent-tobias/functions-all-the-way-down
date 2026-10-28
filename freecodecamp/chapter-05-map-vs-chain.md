# Chapter 5: `map` vs `chain` — The Key Distinction — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

Setup → once map on Maybe clicks, a moment arrives where it doesn't quite work: map returns a Just inside a Just, or the result stops behaving like a plain value.

Framing → most common stumbling block with algebraic types; fix is simple once the distinction is clear; chapter 4 did map, this chapter adds chain.

## What `map` Does

Definition → map applies a function to the value inside a container, wraps the result back in the same container type.

> [Code: Maybe.of(5).map(x => x * 2) → Just(10)]

Walkthrough → x => x * 2 is plain number → plain number; map unwraps Just(5), applies, re-wraps → Just(10).

Contract → function returning a plain value in → wrapped value of the same type out.

## The Problem

Question → what if the function passed to map itself returns a Maybe?

> [Code: curried safeDivide (divisor-first, Nothing on zero divisor) mapped over Maybe.of(10) → Just(Just(5)), nested]

Explanation → safeDivide is curried divisor-first: safeDivide(2) = function from numerator to Maybe (Just of quotient, Nothing if the pre-supplied divisor was 0); map unwraps the outer Just, applies it (producing Just(5)), wraps the result → Just(Just(5)).

Consequence → nested Maybe: getOrElse(0) yields Just(5), not 5; needing getOrElse twice signals the nesting is wrong, not that you should call it twice.

## `chain` as the Solution

Definition → chain (a.k.a. flatMap, bind) is map that flattens: it expects the function to return a container and returns that container directly instead of re-wrapping.

> [Code: Maybe.of(10).chain(safeDivide(2)) → Just(5); chain(safeDivide(0)) → Nothing]

Implementation note → Just's implementation mirrors the definitions exactly:

> [Code: Just's map (wrap fn result) vs chain (return fn result directly, since fn returns a Maybe)]

Slogans → map: "apply this function and wrap the result" / chain: "apply this function and trust it to wrap its own result."

## The Mental Model

Lead-in → simplest way to remember which to use:

List → map = functions that always succeed and return plain values (x => x * 2, s => s.toUpperCase(), item => item.title) / chain = functions that might fail or already return a wrapped value (safeDivide, getUser, parseJSON).

Signature rule → a -> b → map; a -> Maybe b (or Either b, Task b) → chain.

Diagnostic → ever see Just(Just(...)) or Right(Right(...)) → you reached for map when chain was needed.

## Why `Nothing` Makes `chain` Trivial

Point → Nothing needs nothing special for chain:

> [Code: Nothing's chain ignores fn entirely and returns Nothing]

Propagation → any step in a chain returning Nothing → Nothing flows through the rest automatically; no per-step checking, the type handles it.

> [Code: chain of Maybe.of(item) → chain to Maybe.of(i.author) → map authorToString → getOrElse('Unknown Author')]

Reading → null author → Nothing at the chain step → later operations no-op → getOrElse fallback; null never checked explicitly.

## A Concrete Example from the Project

Setup → chapter 4's author normalization already uses each correctly:

> [Code: getAuthorName with authorToString returning a plain string, applied with map, then getOrElse]

Variation → map is right because authorToString returns a plain string; if it returned a Maybe (e.g. because author.name itself might be null), switch to chain:

> [Code: authorToString returning Maybe.of in both branches, getAuthorName switched from map to chain]

Rule restated → choice is determined by what the function returns, not by preference.

## The Monad Laws (Don't Panic)

Demystification → "monad" = container type implementing of, map, chain under a few rules; that's the practical version.

Lead-in → the rules, informally:

List → (1) chain(Maybe.of) returns what you started with — wrap then immediately chain changes nothing / (2) Maybe.of(x).chain(f) equals f(x) — wrap-then-chain equals calling f directly / (3) chain is associative — parenthesization of a chain sequence doesn't matter.

Practical meaning → no need to memorize; in practice the types behave consistently and predictably, chain has no hidden behaviour based on call count or order → that consistency is what makes pipelines on these types safe to build.

## A Few Things to Sit With

Lead-in → before chapter six.

List → (1) Maybe's Nothing carries no information, just absence — but failures have specific reasons (null title, missing link, invalid format); how to represent failure so the reason can be communicated? / (2) normalizeItem faces several distinct failures (item null, title missing, link missing), each with its own message — Nothing can't carry messages; what type could? / (3) fold (met briefly in normalizeItem) takes two functions, one per possible state — how does that differ from getOrElse, and when handle both cases explicitly vs supply a fallback?

Next chapter → Either: Maybe with memory — carries an error message on the failure path, both outcomes handled at the end.
