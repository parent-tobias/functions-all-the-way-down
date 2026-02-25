// src/fetch-feed.js
//
// Builds lazy Tasks that describe how to fetch and process feeds.
// Nothing runs here — fork() is called only in the shell (server.js).

import { Task } from './lib/task.js';
import { when } from './lib/fp-utils.js';
import { normalizeItem, sortByDateDesc, filterByCategory, filterBySearch } from './transforms.js';
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

export const processFeed = (url, { category, search } = {}) =>
  fetchFeed(url)
    .chain(parseFeed)
    .map(feed => feed.items)
    .map(items => items.map(normalizeItem))
    .map(items => items.filter(item => item.valid))
    .map(items => items.map(item => item.data))
    .map(when(category, filterByCategory(category)))
    .map(when(search,   filterBySearch(search)))
    .map(sortByDateDesc);

export const processFeeds = (...urls) =>
  Task.all(urls.map(processFeed))
    .map(feeds => feeds.flat())
    .map(sortByDateDesc);
