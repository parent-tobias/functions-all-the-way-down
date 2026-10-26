# Functions All the Way Down: Chapter 22
## What You've Actually Built

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

We set out to build a working RSS feed aggregator API using functional programming principles. We did that. But along the way, we built something else — a vocabulary, a set of patterns, and a way of thinking about code that doesn't belong to this project. It belongs to you.

Before we close this series and open the next one, it's worth standing back and seeing what's actually in front of us.

## The Arc

**Chapters 1–3** established the ground rules: pure functions, currying, composition. A pure function is a promise — same input, same output, no surprises. Currying turns configuration into composition. `pipe` makes the flow of data visible. These three constraints produce code that can be reasoned about in isolation, and that reason alone justifies them.

**Chapter 4–6** introduced the first two algebraic types. `Maybe` handles absence without null checks scattered everywhere. `Either` handles failure with a reason. `map` and `chain` are the same operation at two levels of complexity — `map` for plain functions, `chain` for functions that return a container. The `fold` at the end is the contract: to leave a container, you must handle every case.

**Chapters 7–8** took the same principles async. `Task` is a lazy promise — nothing runs until you say so. `Task.all` runs effects concurrently and combines the results. `fork` is the async escape hatch, and it lives only in the imperative shell.

**Chapters 9–13** were about discipline. The functional core / imperative shell pattern is not a rule imposed from outside; it's what you get naturally when you push side effects to the edges. Testing pure functions is not a special skill — it's barely any work at all, because pure functions have no hidden state to set up and no side effects to clean up. TDD and FP are natural partners.

**Chapters 14–15** applied the full stack to a real feature. The `/digest` endpoint was built test-first, pure core before async shell, with deliberate decisions about which type belongs where. The Either → Task bridge connected synchronous validation to asynchronous computation in a single expression.

**Chapters 16–18** completed the picture. `mapError` gave Task the same symmetry that `map` already had. Validation showed what happens when you need all the errors, not just the first. IO brought the same lazy-description principle to synchronous side effects — because `console.log` and `process.env` are side effects too, and they deserve the same treatment.

**Chapters 19–21** made it a whole application. Persistence gave it a memory: a store in the shell, database rows treated as untrusted input and given the same discipline as feed items, and the series' first endpoint that writes. Reader gave its dependencies a shape — configuration parsed once, validated as a whole, failing fast with every error named; capabilities passed as an argument, so a handler could be tested against an environment of the test's own making. Production taught it to live in the real world: deadlines on the Tasks that hang, retries on a pure schedule, a health check that asks the store a real question, a shutdown that drains and closes and leaves cleanly — and integration tests that finally ran the whole machine end to end, shell included — the suite stands at 137 tests, all passing. Nothing in the functional core changed to accommodate any of it. That was rather the point of the core.

## The Pattern Underneath

Look at every type in this series. They all have the same shape:

```
Container(value or computation)
  .map(fn)       — transform the inside, stay in the container
  .chain(fn)     — when fn returns a container, flatten instead of nest
  .escape()      — getOrElse / fold / fork / run / runReader — exit at the boundary
```

`map` is: *I have a plain function, apply it to the value inside the container.*
`chain` is: *I have a function that returns a container, apply it and flatten.*
The escape hatch is: *I'm at the boundary. I commit to handling every case here.*

That's it. Every type in the series — Maybe, Either, Task, Validation, IO, Reader — is a variation on this structure. They differ in *what* they contain (a value, a computation, a pair of tracks) and *how* they compose, but the interface is the same. Code written against this interface is predictable, testable, and composable, regardless of which container it's operating on.

## The Reveal

Here's what you've actually been building: the [Fantasy Land specification](https://github.com/fantasyland/fantasy-land).

Fantasy Land is a formal specification for algebraic structures in JavaScript. It defines interfaces — named, lawful contracts — for the patterns that appear over and over in functional programming. You've been implementing it from first principles, without a framework, working through each concept as a problem to be solved before giving it a name.

Here's the mapping:

| What you built | Fantasy Land algebra |
|---|---|
| Anything with `map` | Functor |
| Anything with `ap` | Apply / Applicative |
| Anything with `chain` | Chain / Monad |
| `Maybe.of`, `Either.of`, `Task.of`, `Validation.of`, `IO.of`, `Reader.of` | Applicative `of` |
| `Validation` with `ap` | Applicative (non-monadic) |

The laws you followed intuitively — `map(x => x)` should return an equivalent container, `chain` should flatten but not otherwise change the value — are the *algebraic laws* that give these structures their names. A Functor is not a thing that has `map`; it's a thing that has `map` *and obeys the functor laws*. You've been writing lawful code all along.

Fantasy Land also defines structures you haven't encountered yet. `Semigroup` is anything you can `concat` together. `Monoid` is a Semigroup with an empty value — think arrays, strings, or `Sum(0)`. `Traversable` lets you sequence effects over a collection — mapping an array of URLs to Tasks and running them all. `Bifunctor` is a type with two type parameters that can be mapped on either side (an Either extended with a `mapLeft` for its error side, alongside the `map` it already has, would be one). Each of these is a solved problem with a name and a set of laws.

## These Patterns Are Portable

The RSS aggregator is a Node.js server. But nothing you built in the functional core knows that.

`transforms.js` has no `import http`. `maybe.js` has no knowledge of RSS. `validation.js` could run in a browser, in a CLI tool, in a Cloudflare Worker, in a React component. The algebraic types are pure JavaScript with no dependencies — they go wherever JavaScript goes.

And notice what the last three chapters tested: the shell grew — a database, a validated configuration, deadlines, a health endpoint, a shutdown sequence — and the core did not grow with it. Persistence arrived and the core gained no import; configuration arrived and no pure function learned to read the environment; production arrived and the transforms never heard about it. Portability isn't a claim about the core being small. It's the observation that everything reality added landed in the shell, where reality lives.

A React hook that wraps a remote data fetch in a Task, maps the response, and folds into component state is exactly the same pattern as a Node handler that wraps an RSS fetch in a Task and forks into an HTTP response. The context changes. The structure doesn't.

This is the deeper payoff of functional programming: the patterns you learn transfer. When you encounter Fluture (a production Task implementation), the interface looks familiar. When you look at fp-ts or Effect in TypeScript, the concepts are the same with type annotations. When you read about Haskell's `IO` monad or Scala's `Option`, you recognise them. You've been speaking the language; you just didn't know the name for it.

## What Comes Next

This series taught the patterns by building from scratch. The next series — the second book — takes those same patterns seriously: formally, at scale, in new shapes.

It begins by proving this chapter's portability claim the hard way. Chapter nine promised that the core could serve a different shell unchanged, and this series never cashed that cheque. Book 2 opens by cashing it: a command-line tool built over *this exact core* — the same transforms, the same types, a `cli.js` where `server.js` used to be — printing digests to a terminal instead of serving them over HTTP. Whatever survives that move untouched was really portable. Whatever doesn't was a server assumption wearing a disguise, and we'll name it.

Then the formal turn: the Fantasy Land specification read directly, what it actually requires, and how to verify that implementations are lawful — property-based testing, where the properties are the algebraic laws themselves and the inputs are generated by the hundred. We'll compare the types you built by hand against production libraries — Sanctuary, Fluture, Ramda — and examine where and why they diverge, including where the hand-built versions simply run out of road. We'll encounter the structures that didn't appear here: Semigroup, Monoid, Traversable, Bifunctor, and the optics that grow out of them. And we'll ask what all of this looks like under a type system that can enforce the laws at compile time — fp-ts and Effect in TypeScript — and in other shapes of application entirely: an event-driven worker, a front-end codebase, not just a server.

The series is called *Functions All the Way Down*. The title was always a bit of a hint. Monads all the way down. Functors all the way down. Algebraic structures, from the first `pure function` to the last `.run()`, all the way down.

You've been doing this the whole time. You already know how to continue.
