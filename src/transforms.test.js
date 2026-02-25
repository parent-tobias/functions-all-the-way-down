// src/transforms.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTitles, filterByTitle, sortByDateDesc } from './transforms.js';

const sampleItems = [
  { title: 'Node.js 22 Released', link: 'https://example.com/1', pubDate: 'Mon, 24 Feb 2025 10:00:00 GMT' },
  { title: 'Understanding Async Iterators', link: 'https://example.com/2', pubDate: 'Tue, 25 Feb 2025 08:30:00 GMT' },
  { title: 'Security Patch for Express', link: 'https://example.com/3', pubDate: 'Sun, 23 Feb 2025 14:00:00 GMT' },
];

test('getTitles returns an array of title strings', () => {
  const result = getTitles(sampleItems);
  assert.deepEqual(result, [
    'Node.js 22 Released',
    'Understanding Async Iterators',
    'Security Patch for Express',
  ]);
});

test('filterByTitle filters case-insensitively', () => {
  const filterForNode = filterByTitle('node');
  const result = filterForNode(sampleItems);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Node.js 22 Released');
});

test('sortByDateDesc does not mutate the original array', () => {
  const original = [...sampleItems];
  sortByDateDesc(sampleItems);
  assert.deepEqual(sampleItems, original);
});
