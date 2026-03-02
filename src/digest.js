// src/digest.js
//
// Pure transforms for the /digest endpoint.
// No I/O, no Tasks — just data in, data out.

import { Maybe }      from './lib/maybe.js';
import { toHeadline } from './transforms.js';

// Returns Maybe { newest, oldest } pubDates.
// Nothing if items is empty — there's no date range to report.
// Assumes items are already sorted newest-first.
export const getDateRange = (items) =>
  items.length === 0
    ? Maybe.nothing()
    : Maybe.of({
        newest: items[0].pubDate,
        oldest: items[items.length - 1].pubDate,
      });

// Returns the top n most-frequent category names, sorted by frequency.
// Curried: configure with n, then apply to items.
//   topCategories(5)(items)  or  top5Categories(items)
export const topCategories = (n) => (items) => {
  const counts = items
    .flatMap(item => item.categories)
    .reduce((acc, cat) => ({ ...acc, [cat]: (acc[cat] || 0) + 1 }), {});

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([cat]) => cat);
};

export const top5Categories = topCategories(5);

// Assembles the digest shape from a raw parsed feed and its normalized items.
// rawFeed is the object rss-parser returns; items are normalized and sorted.
export const buildDigest = (rawFeed, items) => ({
  feedTitle:     Maybe.of(rawFeed.title).getOrElse('Untitled Feed'),
  itemCount:     items.length,
  dateRange:     getDateRange(items).getOrElse(null),
  topCategories: top5Categories(items),
  recentItems:   items.slice(0, 5).map(toHeadline),
});
