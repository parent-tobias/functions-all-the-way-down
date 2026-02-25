// src/fetch-feed.js
//
// Builds lazy Tasks that describe how to fetch and process a feed.
// Nothing runs here — fork() is called only in the shell (server.js).

import { Task } from './lib/task.js';
import { normalizeItem, sortByDateDesc } from './transforms.js';
import Parser from 'rss-parser';

const parser = new Parser();

const fetchFeed = url => Task((reject, resolve) => {
  fetch(url)
    .then(res =>
      res.ok
        ? res.text()
        : Promise.reject(new Error(`Failed to fetch feed (${res.status}): ${res.statusText}`))
    )
    .then(resolve)
    .catch(reject);
});

const parseFeed = raw => Task((reject, resolve) =>
  parser.parseString(raw)
    .then(resolve)
    .catch(reject)
);

export const processFeed = (url) =>
  fetchFeed(url)
    .chain(parseFeed)
    .map(feed => feed.items)
    .map(items => items.map(normalizeItem))
    .map(items => items.filter(item => item.valid))
    .map(items => items.map(item => item.data))
    .map(sortByDateDesc);
