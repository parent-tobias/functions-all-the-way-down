// src/index.js — Scratchpad for trying things out
import { pipe } from './lib/fp-utils.js';
import { filterByTitle, sortByDateDesc, getTitles } from './transforms.js';

const sampleItems = [
  { title: 'Node.js 22 Released', pubDate: 'Mon, 24 Feb 2025 10:00:00 GMT' },
  { title: 'Security Patch for Express', pubDate: 'Sun, 23 Feb 2025 14:00:00 GMT' },
  { title: 'Node 22 Performance Improvements', pubDate: 'Sat, 22 Feb 2025 09:00:00 GMT' },
];

// Build a pipeline: filter, sort, extract titles
const getLatestNodeTitles = pipe(
  filterByTitle('node'),
  sortByDateDesc,
  getTitles
);

console.log(getLatestNodeTitles(sampleItems));
// ['Node.js 22 Released', 'Node 22 Performance Improvements']
