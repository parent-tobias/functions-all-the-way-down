// src/lib/task.js
//
// Task represents a computation that will produce a value in the future.
// Unlike Promise, Task is LAZY — nothing runs until you call .fork().

export const Task = fork => ({
  fork,

  map: fn => Task((reject, resolve) => {
    fork(reject, x => resolve(fn(x)));
  }),

  mapError: fn => Task((reject, resolve) => {
    fork(err=>reject(fn(err)), resolve);
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

Task.of       = x => Task((reject, resolve) => resolve(x));
Task.rejected = x => Task((reject, resolve) => reject(x));

// Task.all — run tasks concurrently, collect results in order.
// Fail-fast: any rejection immediately rejects the outer Task.
Task.all = tasks => Task((reject, resolve) => {
  const results  = new Array(tasks.length);
  let   completed = 0;

  tasks.forEach((task, index) => {
    task.fork(
      reject,
      value => {
        results[index] = value;  // preserve input order
        completed += 1;
        if (completed === tasks.length) resolve(results);
      }
    );
  });
});

export default Task;
