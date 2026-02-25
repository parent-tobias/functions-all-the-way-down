// src/lib/task.js
//
// Task represents a computation that will produce a value in the future.
// Unlike Promise, Task is LAZY — nothing runs until you call .fork().
//
// The computation function: (reject, resolve) => void
// reject comes first — error handling is first-class.

export const Task = fork => ({
  fork,

  map: fn => Task((reject, resolve) => {
    fork(reject, x => resolve(fn(x)));
  }),

  chain: fn => Task((reject, resolve) => {
    fork(reject, x => {
      fn(x).fork(reject, resolve);
    });
  }),

  fold: (leftFn, rightFn) => Task((reject, resolve) => {
    fork(
      err => resolve(leftFn(err)),
      x   => resolve(rightFn(x))
    );
  }),
});

// Task.of — wrap a plain value in a Task (always resolves)
Task.of = x => Task((reject, resolve) => resolve(x));

// Task.rejected — wrap a plain value in a Task (always rejects)
Task.rejected = x => Task((reject, resolve) => reject(x));

export default Task;
