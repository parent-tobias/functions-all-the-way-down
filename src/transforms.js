// src/transforms.js
//
// Pure functions for transforming feed data.
//
// Rule 1: Every function here is PURE
//   - Same input → same output, always
//   - No side effects (no logging, no mutation, no network)

import { pluck, firstOf } from './lib/fp-utils.js';

// Extract titles and links using the pluck utility
export const getTitles = pluck('title');
export const getLinks  = pluck('link');

// Filter items that contain a keyword in their title
// Shape: config => data => result (curried)
export const filterByTitle = (searchTerm) => (items) =>
  items.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

// Filter items that contain a keyword in their summary/description
export const filterBySummary = (keyword) => (items) =>
  items.filter(item => {
    const summary = firstOf('description', 'content')(item) || '';
    return summary.toLowerCase().includes(keyword.toLowerCase());
  });

// Filter items by category (handles both 'categories' and 'tags' field names)
export const filterByCategory = (category) => (items) =>
  items.filter(item => {
    const categories = firstOf('categories', 'tags')(item) || [];
    return categories.includes(category);
  });

// Sort items by date (newest first)
// Note: [...items] copies the array to avoid mutating the original
export const sortByDateDesc = (items) =>
  [...items].sort((a, b) =>
    new Date(b.pubDate) - new Date(a.pubDate)
  );
