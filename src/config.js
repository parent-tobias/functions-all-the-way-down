// src/config.js — Configuration, parsed once, at startup
//
// The environment the process was launched with is untrusted input,
// exactly like a request body: several fields, each able to be wrong
// independently. So it gets the chapter-seventeen treatment —
// Validation with a curried constructor, accumulating *every* problem
// into one report instead of failing on whichever came first.
//
// parseConfig returns a Validation: Success(config) or Failure(errors).
// Nothing here touches process.env directly except as the default
// argument, which keeps the parser a pure function of its input —
// and therefore testable with plain objects.

import { Validation, Success, Failure } from './lib/validation.js';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

const validatePort = raw => {
  if (raw === undefined) return Success(3000);
  const port = Number(raw);
  return (Number.isInteger(port) && port >= 1 && port <= 65535)
    ? Success(port)
    : Failure([`PORT must be an integer between 1 and 65535 (got "${raw}")`]);
};

const validateFeedsDb = raw => {
  if (raw === undefined) return Success('feeds.db');
  return (typeof raw === 'string' && raw.trim() !== '')
    ? Success(raw)
    : Failure(['FEEDS_DB must be a non-empty path']);
};

const validateLogLevel = raw => {
  if (raw === undefined) return Success('info');
  return LOG_LEVELS.includes(raw)
    ? Success(raw)
    : Failure([`LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')} (got "${raw}")`]);
};

// Chapter 21: how long a feed fetch may run before the deadline
// wins, and how many times a failed fetch is retried. Same
// treatment as everything else here — defaults when absent, a
// named failure when present and wrong.
const validateFeedTimeoutMs = raw => {
  if (raw === undefined) return Success(10000);
  const ms = Number(raw);
  return (Number.isInteger(ms) && ms > 0)
    ? Success(ms)
    : Failure([`FEED_TIMEOUT_MS must be a positive integer (got "${raw}")`]);
};

const validateFeedRetries = raw => {
  if (raw === undefined) return Success(2);
  const retries = Number(raw);
  return (Number.isInteger(retries) && retries >= 0 && retries <= 5)
    ? Success(retries)
    : Failure([`FEED_RETRIES must be an integer between 0 and 5 (got "${raw}")`]);
};

export const parseConfig = (env = process.env) =>
  Validation.of(port => feedsDb => logLevel => feedTimeoutMs => feedRetries =>
    ({ port, feedsDb, logLevel, feedTimeoutMs, feedRetries }))
    .ap(validatePort(env.PORT))
    .ap(validateFeedsDb(env.FEEDS_DB))
    .ap(validateLogLevel(env.LOG_LEVEL))
    .ap(validateFeedTimeoutMs(env.FEED_TIMEOUT_MS))
    .ap(validateFeedRetries(env.FEED_RETRIES));
