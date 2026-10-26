// src/lib/reader.js
//
// Reader represents a computation that needs an environment before it
// can produce a value. Strip away the wrapper and it is a function in
// disguise — `env => a` — the same way Task is `(reject, resolve) => ...`
// in disguise and IO is `() => ...` in disguise.
//
// Nothing runs when you build a Reader. You describe a computation that
// *would* use an environment; the environment is supplied once, at the
// boundary, by calling .runReader(env). That makes runReader the fourth
// member of the escape-hatch family: Either has fold, Task has fork,
// IO has run, Reader has runReader.

import { Task } from './task.js';

export const Reader = run => ({
  runReader: env => run(env),

  map: fn => Reader(env => fn(run(env))),

  chain: fn => Reader(env => fn(run(env)).runReader(env)),

  inspect: () => 'Reader(env => a)',
});

Reader.of   = x  => Reader(() => x);
Reader.ask  = Reader(env => env);
Reader.asks = fn => Reader(fn);

// ReaderTask — the composition of the two types above: `env => Task`.
// A computation that needs an environment *and* then does async work.
// Every handler in server.js has exactly that shape, which is why this
// is the type the handlers are written in. map and chain thread the
// same environment through every step; nothing runs until the boundary
// supplies the env (runReader) and forks the resulting Task.
export const ReaderTask = run => ({
  runReader: env => run(env),

  map: fn => ReaderTask(env => run(env).map(fn)),

  chain: fn => ReaderTask(env => run(env).chain(x => fn(x).runReader(env))),

  mapError: fn => ReaderTask(env => run(env).mapError(fn)),

  inspect: () => 'ReaderTask(env => Task)',
});

ReaderTask.of       = x => ReaderTask(() => Task.of(x));
ReaderTask.rejected = x => ReaderTask(() => Task.rejected(x));
ReaderTask.ask      = ReaderTask(env => Task.of(env));
ReaderTask.asks     = fn => ReaderTask(env => Task.of(fn(env)));

// Lifting: a plain Task doesn't need the environment, and a plain
// Reader resolves synchronously — both embed into ReaderTask.
ReaderTask.fromTask   = task   => ReaderTask(() => task);
ReaderTask.fromReader = reader => ReaderTask(env => Task.of(reader.runReader(env)));

export default Reader;
