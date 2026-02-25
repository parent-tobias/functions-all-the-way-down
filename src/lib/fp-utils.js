// src/lib/fp-utils.js
// Reusable, domain-agnostic FP utilities.

// Composition — left to right
export const pipe = (...fns) => x =>
  fns.reduce((acc, fn) => fn(acc), x);

// Composition — right to left (mathematical convention)
export const compose = (...fns) => x =>
  fns.reduceRight((acc, fn) => fn(acc), x);

// Curried property access
export const getProp = (prop) => (item) => item[prop];

// Extract a property from each item in an array
export const pluck = (prop) => (items) => items.map(getProp(prop));

// Try multiple field names in order, return the first non-null value.
// Uses != null to catch both null and undefined.
export const firstOf = (...keys) => (obj) =>
  keys.map(k => obj[k]).find(v => v != null);

// The identity function — returns its argument unchanged.
// Useful as a default/no-op in higher-order contexts.
export const identity = x => x;
