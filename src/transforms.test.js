// src/transforms.test.js
import { test, describe } from 'node:test';
import assert from 'assert';
import { normalizeItem, validateItem } from './transforms.js';

describe('normalizeItem', () => {
  test('normalizeItem should return valid normalized item', () => {
    const input = {
      title: 'Test Item',
      link: 'http://example.com/test-item',
      description: 'This is a test item.',
      author: 'Test author',
      categories: ['Test', 'Example'],
      pubDate: '2024-01-01T00:00:00Z',
    };

    const result = normalizeItem(input);

    assert.equal(result.valid, true);
    assert.deepEqual(result.data, {
      title:      'Test Item',
      link:       'http://example.com/test-item',
      summary:    'This is a test item.',
      author:     'Test author',
      categories: ['Test', 'Example'],
      pubDate:    '2024-01-01T00:00:00Z',
    });
  });

  test('normalizeItem should return error for null item', () => {
    const result = normalizeItem(null);
    assert.equal(result.valid, false);
    assert.equal(result.error, 'Item was null');
  });

  test('normalizeItem should return an error for a missing title', () => {
    const result = normalizeItem({});
    assert.equal(result.valid, false);
    assert.equal(result.error, 'Title was null');
  });

  test('normalizeItem should return an error for a missing link', () => {
    const result = normalizeItem({ title: 'Test Item' });
    assert.equal(result.valid, false);
    assert.equal(result.error, 'Link was null');
  });

  test('normalizeItem should handle missing description and author', () => {
    const input = {
      title:   'Test Item',
      link:    'http://example.com/test-item',
      pubDate: '2024-01-01T00:00:00Z',
    };

    const result = normalizeItem(input);

    assert.equal(result.valid, true);
    assert.equal(result.data.summary, 'No description available');
    assert.equal(result.data.author,  'Unknown Author');
  });
});

describe('validateItem', () => {
  test('validateItem should return valid for item with title and link', () => {
    const input = { title: 'Test Item', link: 'http://example.com/test-item' };
    const result = validateItem(input);
    assert.equal(result.valid, true);
    assert.deepEqual(result.data, input);
  });
  
  test('validateItem should return error for missing title', () => {
    const input = { link: 'http://example.com/test-item' };
    const result = validateItem(input);
    assert.equal(result.valid, false);
    assert.deepEqual(result.errors, ['Missing title']);
  });
  test('validateItem should return error for missing link', () => {
    const input = { title: 'Test Item' };
    const result = validateItem(input);
    assert.equal(result.valid, false);
    assert.deepEqual(result.errors, ['Missing link']);
  });
  test('validateItem should return errors for missing title and link', () => {
    const input = {};
    const result = validateItem(input);
    assert.equal(result.valid, false);
    assert.deepEqual(result.errors, ['Missing title', 'Missing link']);
  });
});
