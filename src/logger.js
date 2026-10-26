// src/logger.js — The logger capability
//
// Chapter eighteen's logger was a function from a message to an IO:
// describe the log line now, print it when the shell runs the IO.
// makeLogger keeps exactly that shape and adds the one thing a real
// logger needs: a level. Each method returns an IO, and the IO does
// nothing at all if the message is below the configured level —
// the decision is made when the IO is built into a pipeline, the
// printing still happens only at .run().

import { IO } from './lib/io.js';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

export const makeLogger = (level = 'info') => {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const at = (name, write) => message =>
    IO(() => { if (LEVELS[name] >= threshold) write(message); });

  return {
    debug: at('debug', msg => console.log(msg)),
    info:  at('info',  msg => console.log(msg)),
    warn:  at('warn',  msg => console.error(msg)),
    error: at('error', msg => console.error(msg)),
  };
};
