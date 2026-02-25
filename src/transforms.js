// src/transforms.js
//
// Pure functions for transforming feed data.
//
// Rule 1: Every function here is PURE
//   - Same input → same output, always
//   - No side effects (no logging, no mutation, no network)
//
// Rule 2: Functions do ONE thing
//   - Small, focused, composable
//
// Rule 3: Data in, data out
//   - We transform, we don't "do things"

// Extract just the titles from a list of items
export const getTitles = (items) =>
  items.map(item => item.title);

// Extract just the links from a list of items
export const getLinks = (items) =>
  items.map(item => item.link);

// Filter items that contain a keyword in their title
// Shape: config => data => result (curried for composability)
export const filterByTitle = (searchTerm) => (items) =>
  items.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

// Sort items by date (newest first)
// Note: [...items] copies the array to avoid mutating the original
export const sortByDateDesc = (items) =>
  [...items].sort((a, b) =>
    new Date(b.pubDate) - new Date(a.pubDate)
  );
