# Functions All the Way Down: Chapter 19
## Persistence — The App Remembers

*Part of the series: Functions All the Way Down: Building an API using Functional Programming*

---

Chapter eighteen ended with a fair challenge. `getPort.run()` is called at module level in `server.js`, which means it runs when the file is first imported — so what does IO actually add beyond naming the intent?

Here is an answer that only becomes visible when the program grows: naming the intent is what allows startup to become a *sequence*. Reading the port used to be the only described effect at startup. This chapter gives startup a second job — open a database and make sure its tables exist — and a third job at the other end of the process's life is already implied: everything the app saves has to survive the process stopping.

Because right now, nothing survives. Restart the server and every feed a user has ever asked about is gone. Each request refetches URLs the app has already fetched, from a user who has already told it what they care about. An app that forgets everything the moment it stops isn't an app. It's a demo with good manners.

This chapter fixes that. The app learns to remember.

## A Store in the Shell

Persistence is a side effect — arguably *the* side effect — so it lives where side effects live: in the shell. We add one new file, `src/store.js`, and we add it under the series' standing constraint: no new dependencies. The only production dependency in this project is still `rss-parser`. So the database is the one built into Node itself: **SQLite**, via the `node:sqlite` module.

One honest note about that choice before we build on it: `node:sqlite` is young. It arrived as an experimental module in Node 22.5, and while it needs no special flag on Node 24, its API has not finished settling. We accept that here for two reasons: the constraint (no new dependencies) leaves few alternatives, and the surface we actually use — prepare a statement, run it, read rows — is small enough to change in an afternoon if the API shifts underneath us.

The schema is described as data: an ordered list of SQL statements, executed once when the store is created.

```js
// src/store.js
const migrations = [
  `CREATE TABLE IF NOT EXISTS feeds (
     id         INTEGER PRIMARY KEY,
     url        TEXT NOT NULL UNIQUE,
     title      TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
];

export const createStore = (dbPath) => {
  const db = new DatabaseSync(dbPath);
  migrations.forEach(sql => db.exec(sql));
  // ... saveFeed, loadFeeds, close
};
```

A migration list sounds grand for one `CREATE TABLE`. It earns its keep the first time the schema changes: a second table or a new column is a second entry in the list, appended, not woven into startup code. The schema is a description. Executing it is startup's job — described in the core's neighbourhood, executed at the boundary, exactly like everything else in this series.

## Rows Are Untrusted Input

Data comes back out of the database as rows: plain objects with `id`, `url`, `title`, `created_at`. It is tempting to treat rows as *ours* — we wrote them, after all. Resist that. A row crosses the boundary into the core just as surely as an RSS item does, and it deserves the same treatment `normalizeItem` gives a feed item: check the field that matters, shape the rest, carry a reason if it's unusable.

```js
// src/store.js
export const rowToFeed = row =>
  Either.fromNullable(row, 'Row was null')
    .chain(r => Either.fromNullable(r.url, 'Feed row was missing a url')
      .map(url => ({ ...r, url })))
    .map(r => ({
      id:        r.id,
      url:       r.url,
      title:     r.title ?? 'Untitled Feed',
      createdAt: r.created_at,
    }));
```

The one field a saved feed cannot exist without is its URL, so that's the field Either guards. A missing title is not a failure — it's an absence, handled the way `buildDigest` handles a missing feed title: fall back to `'Untitled Feed'` and carry on.

This is the design principle from chapter four, one more time: **validate at the boundary, operate confidently inside.** The boundary just got bigger. It now includes everything the app itself wrote down earlier — because "earlier" is another country, and its data is foreign until it's been checked.

## Saving and Loading as Tasks

DatabaseSync is, as the name says, synchronous — but the store's operations are still expressed as Tasks. Not because SQLite needs it, but because the handlers do: a Task is the currency every pipeline in `server.js` already trades in, and `saveFeed` should compose with `chain` and `mapError` exactly the way `processFeed` does.

```js
// src/store.js
const saveFeed = ({ url, title }) => Task((reject, resolve) => {
  try {
    const { lastInsertRowid } = insertFeed.run(url, title ?? null);
    rowToFeed(selectById.get(Number(lastInsertRowid)))
      .fold(err => reject(new Error(err)), resolve);
  } catch (err) {
    isUniqueViolation(err)
      ? reject({ status: 409, message: `Feed already saved: ${url}` })
      : reject(err);
  }
});
```

Notice the duplicate case. The `UNIQUE` constraint on `url` is the guard, and SQLite reports a violation as an error — but saving a feed twice is not a crash. It's a domain outcome: the feed is already remembered. So the store translates the constraint violation into the shaped rejection the shell already knows how to send, `{ status: 409, message: ... }`, and lets every other error reject raw, to be shaped by the handler's `mapError` into a 500. Status codes are decided at the boundary, where chapter sixteen put them.

`loadFeeds` runs every row through `rowToFeed` and keeps the Rights — a row that can't be shaped isn't served, the same way `processFeed` filters out items that fail normalisation.

## The First Write Endpoint

Everything so far in this API has been a read. `POST /feeds` is the first endpoint that changes the world, and it arrives carrying the chapter-seventeen payoff: a request body is untrusted input with *several* fields that can be wrong independently, so it is validated with Validation, accumulating every failure at once.

```js
// src/transforms.js
export const validateFeedInput = input =>
  Validation.of(url => title => ({ url, title }))
    .ap(validateFeedUrl(input?.url))
    .ap(validateFeedTitle(input?.title))
    .fold(
      errors => ({ valid: false, errors }),
      feed   => ({ valid: true,  data: feed })
    );
```

`validateFeedUrl` requires a present, parseable http or https URL; `validateFeedTitle` allows the title to be absent but not to be the wrong type. A body of `{"url": "not a url", "title": 42}` fails with both messages — `Invalid url; Invalid title` — not whichever one happened to be checked first.

The handler itself is the Either → Task bridge from chapter fifteen, one more time:

```js
// src/server.js
readBody(req)
  .chain(body => {
    const result = validateFeedInput(body);
    return (result.valid
      ? Either.of(result.data)
      : Left({ status: 400, message: result.errors.join('; ') }))
      .fold(Task.rejected, Task.of);
  })
  .chain(feed => store.saveFeed(feed))
  .mapError(err => err && typeof err.status === 'number' ? err : ({ status: 500, message: `Error saving feed: ${err.message ?? err}` }))
  .fork(
    err  => sendError(res, err.status, err.message),
    feed => sendJSON(res, 201, feed)
  );
```

The semantics, in full: **201** with the saved feed on success, **409** for a duplicate, **400** with every validation message for a bad body. Its companion, `GET /feeds/saved`, simply loads the store and returns what the app remembers, as a 200. Notice what it does *not* do: fetch. Reporting what is saved is the store's job; fetching is `/feed`'s; composing the two is now a pipeline problem, not an architecture problem.

The store itself is created once, at startup, from the `FEEDS_DB` environment variable or a default path — one direct `process.env` read, sitting next to `getPort`. Hold that thought; it becomes next chapter's opening question.

## Testing the Store

The pure parts are tested first, in the usual way: `rowToFeed` and `validateFeedInput` take plain values and return plain values, and their tests need no database at all. The store's own tests run against an in-memory database and a temporary file — including the one that matters most: save a feed, close the store, reopen it, and find the feed still there. Those are the first tests in the series that touch a real resource, a deliberate small step from unit tests toward integration tests.

## The Honest Limitation

Saving one feed is one SQL statement, so atomicity comes free. It will not stay free. The day a feature writes two things that must succeed or fail together — a feed and its items, say — a save is a *transaction*, and no arrangement of pure one-row functions makes a half-written transaction acceptable. Pretending otherwise would be dishonest.

The answer is the architecture's answer: **the shell owns atomicity; the core owns shape.** Transactions will be the store's problem, conducted at the boundary, around core transforms that neither know nor care that a transaction exists.

## A Few Things to Sit With

Before chapter twenty:

- The store is created in `server.js` from `process.env.FEEDS_DB`, one line away from where `getPort` reads `API_PORT`. The port, the database path, a log level if the logger ever grows one — configuration is currently a scatter of one-off reads at startup. What would it mean to describe the whole environment *once*, as a single value, and pass it to the parts of the app that need it?
- The handlers close over `store` simply because the module created it above them. If you wanted to test `handleSaveFeedRequest` against a throwaway in-memory store, what would have to change about how the handler gets its store?
- Task is a function in disguise — `(reject, resolve) => ...`. IO is a function in disguise — `() => ...`. What type would *a computation that needs an environment before it can produce a value* be a disguise for? What would its `map` and `chain` look like?

Chapter twenty builds exactly that type. It's called Reader — and it turns configuration and dependencies from things the app *reaches for* into things the app is *given*.
