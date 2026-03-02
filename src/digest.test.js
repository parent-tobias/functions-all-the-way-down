import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getDateRange, topCategories, top5Categories, buildDigest } from './digest.js';

// Normalized items, sorted newest-first — the shape buildDigest receives.
const sampleItems = [
  {
    title:      'Node.js 22 Released',
    link:       'https://example.com/1',
    summary:    'The latest Node.js release.',
    author:     'Author One',
    categories: ['Node', 'JavaScript'],
    pubDate:    'Tue, 25 Feb 2025 10:00:00 GMT',
  },
  {
    title:      'Understanding Async Iterators',
    link:       'https://example.com/2',
    summary:    'A deep dive into async iterators.',
    author:     'Author Two',
    categories: ['JavaScript', 'Async'],
    pubDate:    'Mon, 24 Feb 2025 08:30:00 GMT',
  },
  {
    title:      'Security Patch for Express',
    link:       'https://example.com/3',
    summary:    'Critical security update.',
    author:     'Author Three',
    categories: ['Security', 'Node'],
    pubDate:    'Sun, 23 Feb 2025 14:00:00 GMT',
  },
];

describe('getDateRange', () => {
  test('returns Nothing for an empty array', () => {
    const result = getDateRange([]).getOrElse(null);
    assert.strictEqual(result, null);
  });

  test('returns { newest, oldest } pubDates for a non-empty array', () => {
    const result = getDateRange(sampleItems).getOrElse(null);
    assert.deepStrictEqual(result, {
      newest: 'Tue, 25 Feb 2025 10:00:00 GMT',
      oldest: 'Sun, 23 Feb 2025 14:00:00 GMT',
    });
  });

  test('newest and oldest are the same for a single-item array', () => {
    const result = getDateRange([sampleItems[0]]).getOrElse(null);
    assert.deepStrictEqual(result, {
      newest: 'Tue, 25 Feb 2025 10:00:00 GMT',
      oldest: 'Tue, 25 Feb 2025 10:00:00 GMT',
    });
  });
});

describe('topCategories', () => {
  // Category counts in sampleItems:
  //   Node: 2, JavaScript: 2, Async: 1, Security: 1

  test('returns the most frequent categories, up to n', () => {
    const result = topCategories(2)(sampleItems);
    assert.strictEqual(result.length, 2);
    // Node and JavaScript both appear twice — both should be in the top 2
    assert.ok(result.includes('Node'));
    assert.ok(result.includes('JavaScript'));
  });

  test('returns fewer than n when there are fewer distinct categories', () => {
    const result = topCategories(10)(sampleItems);
    assert.strictEqual(result.length, 4); // only 4 distinct categories exist
  });

  test('returns an empty array when items have no categories', () => {
    const noCatItems = sampleItems.map(item => ({ ...item, categories: [] }));
    assert.deepStrictEqual(topCategories(5)(noCatItems), []);
  });

  test('top5Categories produces the same result as topCategories(5)', () => {
    assert.deepStrictEqual(top5Categories(sampleItems), topCategories(5)(sampleItems));
  });
});

describe('buildDigest', () => {
  test('builds the full digest shape from a feed with a title', () => {
    const result = buildDigest({ title: 'Test Feed' }, sampleItems);

    assert.strictEqual(result.feedTitle, 'Test Feed');
    assert.strictEqual(result.itemCount, 3);
    assert.deepStrictEqual(result.dateRange, {
      newest: 'Tue, 25 Feb 2025 10:00:00 GMT',
      oldest: 'Sun, 23 Feb 2025 14:00:00 GMT',
    });
    assert.deepStrictEqual(result.recentItems[0], {
      title: 'Node.js 22 Released',
      link:  'https://example.com/1',
      date:  'Tue, 25 Feb 2025 10:00:00 GMT',
    });
  });

  test('defaults feedTitle to "Untitled Feed" when rawFeed has no title', () => {
    const result = buildDigest({}, sampleItems);
    assert.strictEqual(result.feedTitle, 'Untitled Feed');
  });

  test('dateRange is null and recentItems is empty for an empty feed', () => {
    const result = buildDigest({ title: 'Empty Feed' }, []);
    assert.strictEqual(result.itemCount, 0);
    assert.strictEqual(result.dateRange, null);
    assert.deepStrictEqual(result.recentItems, []);
  });

  test('recentItems contains at most 5 items regardless of feed size', () => {
    const manyItems = Array.from({ length: 7 }, (_, i) => ({
      ...sampleItems[0],
      title: `Item ${i + 1}`,
      link:  `https://example.com/${i + 1}`,
    }));
    const result = buildDigest({ title: 'Big Feed' }, manyItems);
    assert.strictEqual(result.recentItems.length, 5);
  });
});
