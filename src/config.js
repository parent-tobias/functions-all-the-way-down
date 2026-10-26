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

export const parseConfig = (env = process.env) =>
  Validation.of(port => feedsDb => logLevel => ({ port, feedsDb, logLevel }))
    .ap(validatePort(env.PORT))
    .ap(validateFeedsDb(env.FEEDS_DB))
    .ap(validateLogLevel(env.LOG_LEVEL));
