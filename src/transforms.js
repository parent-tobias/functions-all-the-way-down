// src/transforms.js
//
// Pure functions for transforming feed data.

import { Either }              from './lib/either.js';
import { Maybe }               from './lib/maybe.js';
import { Validation, Success, Failure } from './lib/validation.js';
import { pluck, firstOf, anyPass } from './lib/fp-utils.js';

// Extractors
export const getTitles = pluck('title');
export const getLinks  = pluck('link');

// Filters (curried: config => data => result)
export const filterByTitle = (searchTerm) => (items) =>
  items.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

export const filterBySummary = (keyword) => (items) =>
  items.filter(item => {
    const summary = firstOf('description', 'content')(item) || '';
    return summary.toLowerCase().includes(keyword.toLowerCase());
  });

export const filterByCategory = (category) => (items) =>
  items.filter(item => {
    const categories = firstOf('categories', 'tags')(item) || [];
    return categories.includes(category);
  });

const matchesSearch = keyword => item =>
  anyPass(
    i => i.title.toLowerCase().includes(keyword.toLowerCase()),
    i => (i.summary || '').toLowerCase().includes(keyword.toLowerCase())
  )(item);

export const filterBySearch = (keyword) => (items) =>
  items.filter(matchesSearch(keyword));

// validators
export const validateHasTitle = title =>
  title ? Success(title) : Failure(['Missing title']);

export const validateHasLink = link =>
  link ? Success(link) : Failure(['Missing link']);

// Sorter
export const sortByDateDesc = (items) =>
  [...items].sort((a, b) =>
    new Date(b.pubDate) - new Date(a.pubDate)
  );

// Shape converters
export const toHeadline  = item => ({ title: item.title, link: item.link, date: item.pubDate });
export const toHeadlines = items => items.map(toHeadline);

// Normalisation
const authorToString = author =>
  typeof author === 'string' ? author : author?.name;

const getAuthorName = obj =>
  Maybe.of(firstOf('author', 'dc:creator')(obj))
    .map(authorToString)
    .getOrElse('Unknown Author');

export const normalizeItem = item =>
  Either.fromNullable(item, 'Item was null')
    .chain(i =>
      Either.fromNullable(i.title, 'Title was null')
        .map(title => ({ ...i, title }))
    )
    .chain(i =>
      Either.fromNullable(i.link, 'Link was null')
        .map(link => ({ ...i, link }))
    )
    .map(i => ({
      title:      i.title,
      link:       i.link,
      summary:    firstOf('description', 'content')(i) || 'No description available',
      author:     getAuthorName(i),
      categories: firstOf('categories', 'tags')(i) || [],
      pubDate:    i.pubDate,
    }))
    .fold(
      err  => ({ valid: false, error: err }),
      data => ({ valid: true,  data })
    );

export const validateItem = item =>
  Validation.of(title => link => item)
    .ap(validateHasTitle(item.title))
    .ap(validateHasLink(item.link))
    .fold(
      errors => ({ valid:false, errors }),
      item => ({ valid: true, data: item })
    );