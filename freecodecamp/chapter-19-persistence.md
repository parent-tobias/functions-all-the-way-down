# Chapter 19: Persistence — The App Remembers — freeCodeCamp skeleton
> Skeleton only: one sentence per paragraph of the original, for rewriting in your own words. Not publishable prose.

Note: series line — part of "Functions All the Way Down: Building an API using Functional Programming".

Note: Ch. 18 ended on a fair challenge → `getPort.run()` runs at module level, i.e. on import — so what does IO add beyond naming the intent?

Note: the answer only shows when the program grows → naming the intent is what lets startup become a *sequence*; reading the port was the only described startup effect, this chapter gives startup a second job (open a database, make sure its tables exist), and a third job at the other end of the process's life is already implied: everything saved has to survive the process stopping.

Note: right now nothing survives → restart the server and every feed ever asked about is gone; each request refetches URLs already fetched, for a user who already said what they care about; an app that forgets everything on stop isn't an app, it's a demo with good manners.

Note: this chapter fixes that → the app learns to remember.

## A Store in the Shell

Note: persistence is a side effect — arguably *the* side effect — so it lives in the shell → one new file, `src/store.js`, under the series' standing constraint of no new dependencies (only production dependency is still `rss-parser`); the database is the one built into Node itself: **SQLite** via the `node:sqlite` module.

Note: honest note on that choice before building on it → `node:sqlite` is young (experimental in Node 22.5; no special flag needed on Node 24, but its API hasn't finished settling); accepted for two reasons: the no-new-dependencies constraint leaves few alternatives, and the surface actually used (prepare a statement, run it, read rows) is small enough to change in an afternoon if the API shifts.

Note: the schema is described as data → an ordered list of SQL statements, executed once when the store is created →

> [Code: store.js — migrations list with the feeds CREATE TABLE, and createStore opening DatabaseSync and running them]

Note: a migration list sounds grand for one `CREATE TABLE` → it earns its keep at the first schema change: a second table or new column = a second entry appended to the list, not woven into startup code; the schema is a description, executing it is startup's job — described in the core's neighbourhood, executed at the boundary, like everything else in the series.

## Rows Are Untrusted Input

Note: data comes back out as rows (plain objects: `id`, `url`, `title`, `created_at`) → tempting to treat rows as *ours* since we wrote them; resist: a row crosses the boundary into the core just like an RSS item, and deserves `normalizeItem`'s treatment — check the field that matters, shape the rest, carry a reason if unusable →

> [Code: rowToFeed — Either guards the url, then maps the row into the shaped feed object]

Note: the one field a saved feed can't exist without is its URL → that's the field Either guards; a missing title is not a failure but an absence → fall back to `'Untitled Feed'` and carry on, the way `buildDigest` handles a missing feed title.

Note: Ch. 4's design principle one more time → **validate at the boundary, operate confidently inside**; the boundary just got bigger: it now includes everything the app itself wrote down earlier, because "earlier" is another country and its data is foreign until checked.

## Saving and Loading as Tasks

Note: DatabaseSync is synchronous, as the name says → but store operations are still expressed as Tasks; not because SQLite needs it, because the handlers do: Task is the currency every pipeline in server.js already trades in, and `saveFeed` should compose with `chain`/`mapError` exactly like `processFeed` →

> [Code: saveFeed as a Task — insert, re-read the row through rowToFeed, unique-violation translated to a shaped 409 rejection]

Note: the duplicate case → the `UNIQUE` constraint on `url` is the guard and SQLite reports a violation as an error, but saving a feed twice is not a crash, it's a domain outcome (the feed is already remembered); so the store translates the violation into the shaped rejection the shell already sends, `{ status: 409, message: ... }`, and lets every other error reject raw for the handler's `mapError` to shape into a 500 → status codes decided at the boundary, where Ch. 16 put them.

Note: `loadFeeds` runs every row through `rowToFeed` and keeps the Rights → a row that can't be shaped isn't served, same as `processFeed` filtering out items that fail normalisation.

## The First Write Endpoint

Note: everything in the API so far has been a read → `POST /feeds` is the first endpoint that changes the world, and it arrives carrying the Ch. 17 payoff: a request body is untrusted input with *several* independently-wrongable fields, so it's validated with Validation, accumulating every failure at once →

> [Code: validateFeedInput in transforms.js — Validation.of with ap over the url and title validators, folded to a plain result]

Note: `validateFeedUrl` requires a present, parseable http/https URL; `validateFeedTitle` allows an absent title but not a wrong-typed one → a body of `{"url": "not a url", "title": 42}` fails with both messages (`Invalid url; Invalid title`), not whichever was checked first.

Note: the handler itself is the Either → Task bridge from Ch. 15, one more time →

> [Code: POST /feeds handler — readBody, validate, bridge to Task, chain into store.saveFeed, mapError, fork to 201 or the shaped error]

Note: the semantics in full → **201** with the saved feed on success, **409** for a duplicate, **400** with every validation message for a bad body; companion `GET /feeds/saved` just loads the store and returns what the app remembers as a 200 — and note what it does *not* do: fetch (reporting what's saved is the store's job, fetching is `/feed`'s, composing the two is now a pipeline problem, not an architecture problem).

Note: the store is created once, at startup, from the `FEEDS_DB` environment variable or a default path → one direct `process.env` read sitting next to `getPort`; hold that thought, it becomes next chapter's opening question.

## Testing the Store

Note: pure parts tested first, the usual way → `rowToFeed` and `validateFeedInput` take plain values and return plain values, tests need no database at all; the store's own tests run against an in-memory database and a temporary file — including the one that matters most: save a feed, close the store, reopen it, feed still there; these are the first tests in the series to touch a real resource, a deliberate small step from unit tests toward integration tests.

## The Honest Limitation

Note: saving one feed = one SQL statement → atomicity comes free, and it will not stay free: the day a feature writes two things that must succeed or fail together (a feed and its items), a save is a *transaction*, and no arrangement of pure one-row functions makes a half-written transaction acceptable → pretending otherwise would be dishonest.

Note: the answer is the architecture's answer → **the shell owns atomicity; the core owns shape**; transactions will be the store's problem, conducted at the boundary, around core transforms that neither know nor care a transaction exists.

## A Few Things to Sit With

Note: before chapter twenty →

Note: questions to sit with → the store is created in server.js from `process.env.FEEDS_DB`, one line from where `getPort` reads `API_PORT` — port, database path, a future log level: configuration is currently a scatter of one-off startup reads — what would it mean to describe the whole environment *once*, as a single value, and pass it to the parts that need it?; the handlers close over `store` only because the module created it above them — to test `handleSaveFeedRequest` against a throwaway in-memory store, what would have to change about how the handler gets its store?; Task is a function in disguise (`(reject, resolve) => ...`), IO is a function in disguise (`() => ...`) — what type would *a computation that needs an environment before it can produce a value* be a disguise for, and what would its `map` and `chain` look like?

Note: Ch. 20 preview → builds exactly that type, called Reader — configuration and dependencies become things the app is *given* instead of things it *reaches for*.
