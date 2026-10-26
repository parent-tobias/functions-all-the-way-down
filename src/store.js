// src/store.js — The persistence layer
//
// Part of the imperative shell: this file talks to the disk, so it is
// allowed to be impure. But it speaks the core's language — every
// operation is a lazy Task, and every value that crosses the boundary
// in either direction is validated by a pure transform first.

import { DatabaseSync } from 'node:sqlite';
import { Task }   from './lib/task.js';
import { Either } from './lib/either.js';

// The schema, described as data: an ordered list of SQL statements,
// executed once at startup. Adding a table or a column later means
// appending a statement — the description grows; the startup code
// that executes it doesn't change.
const migrations = [
  `CREATE TABLE IF NOT EXISTS feeds (
     id         INTEGER PRIMARY KEY,
     url        TEXT NOT NULL UNIQUE,
     title      TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
];

// A database row is untrusted input — it comes from outside the core,
// exactly like an RSS item does. rowToFeed gives it the same treatment
// normalizeItem gives a feed item: check the field that matters, shape
// the rest, and let Either carry the reason if it's unusable.
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

// SQLite reports a UNIQUE violation with errcode 2067
// (SQLITE_CONSTRAINT_UNIQUE). A duplicate feed is a domain outcome,
// not a crash — saveFeed translates it into the shaped rejection the
// shell already knows how to send.
const isUniqueViolation = err =>
  err.errcode === 2067 || /UNIQUE constraint failed/.test(err.message);

export const createStore = (dbPath) => {
  const db = new DatabaseSync(dbPath);
  migrations.forEach(sql => db.exec(sql));

  const insertFeed = db.prepare(
    'INSERT INTO feeds (url, title) VALUES (?, ?)');
  const selectById = db.prepare(
    'SELECT id, url, title, created_at FROM feeds WHERE id = ?');
  const selectAll = db.prepare(
    'SELECT id, url, title, created_at FROM feeds ORDER BY id');

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

  const loadFeeds = () => Task((reject, resolve) => {
    try {
      resolve(selectAll.all()
        .map(row => rowToFeed(row).fold(() => [], feed => [feed]))
        .flat());
    } catch (err) {
      reject(err);
    }
  });

  // Chapter 21: the health check's probe. A trivial *real* query —
  // if the database can't answer this, it can't answer anything —
  // resolving to the number of feeds the store remembers.
  const countAll = db.prepare('SELECT COUNT(*) AS count FROM feeds');

  const ping = () => Task((reject, resolve) => {
    try {
      resolve(countAll.get().count);
    } catch (err) {
      reject(err);
    }
  });

  const close = () => db.close();

  return { saveFeed, loadFeeds, ping, close };
};
