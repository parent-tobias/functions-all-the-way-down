// src/config.test.js
import { test, describe } from 'node:test';
import assert from 'assert';
import { parseConfig } from './config.js';

// parseConfig returns a Validation; fold it into a plain shape
// the assertions can compare directly.
const outcome = env => parseConfig(env).fold(
  errors => ({ valid: false, errors }),
  config => ({ valid: true, config })
);

describe('parseConfig', () => {
  test('an empty environment yields the defaults', () => {
    assert.deepEqual(outcome({}), {
      valid: true,
      config: { port: 3000, feedsDb: 'feeds.db', logLevel: 'info' },
    });
  });

  test('valid values are parsed into the config shape', () => {
    assert.deepEqual(outcome({ PORT: '8080', FEEDS_DB: '/tmp/x.db', LOG_LEVEL: 'debug' }), {
      valid: true,
      config: { port: 8080, feedsDb: '/tmp/x.db', logLevel: 'debug' },
    });
  });

  test('a bad PORT and a bad LOG_LEVEL accumulate into one Failure', () => {
    const result = outcome({ PORT: 'abc', LOG_LEVEL: 'loud' });
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 2);
    assert.match(result.errors[0], /PORT/);
    assert.match(result.errors[1], /LOG_LEVEL/);
  });

  test('a single bad value fails with a single message', () => {
    const result = outcome({ PORT: '70000' });
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /PORT/);
  });

  test('a non-integer PORT is invalid', () => {
    assert.equal(outcome({ PORT: '30.5' }).valid, false);
  });

  test('an empty FEEDS_DB is invalid', () => {
    const result = outcome({ FEEDS_DB: '   ' });
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /FEEDS_DB/);
  });

  test('every documented log level is accepted', () => {
    for (const logLevel of ['debug', 'info', 'warn', 'error']) {
      assert.equal(outcome({ LOG_LEVEL: logLevel }).config.logLevel, logLevel);
    }
  });
});
