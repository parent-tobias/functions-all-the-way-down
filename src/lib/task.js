// src/lib/task.js
//
// Task represents a computation that will produce a value in the future.
// Unlike Promise, Task is LAZY — nothing runs until you call .fork().
//
// Chapter 21 hardens the type for production:
//   - fork settles exactly once, however the executor behaves
//     (the settle-once guard chapter eight's limitations asked for);
//   - .timeout(ms) races a Task against a deadline;
//   - .retry(retries, baseMs) re-runs a Task on rejection, waiting
//     on a pure backoff schedule (see delays below).

export const Task = run => {
  // The guard lives here, in fork, so that *every* Task — built by
  // hand, composed with map/chain, or raced by Task.all — settles
  // exactly once. Whichever of reject/resolve is called first wins;
  // everything after that is ignored.
  const fork = (reject, resolve) => {
    let settled = false;
    const guardedReject = err => {
      if (!settled) { settled = true; reject(err); }
    };
    const guardedResolve = value => {
      if (!settled) { settled = true; resolve(value); }
    };
    try {
      run(guardedReject, guardedResolve);
    } catch (err) {
      guardedReject(err);
    }
  };

  return {
    fork,

    map: fn => Task((reject, resolve) => {
      fork(reject, x => resolve(fn(x)));
    }),

    mapError: fn => Task((reject, resolve) => {
      fork(err => reject(fn(err)), resolve);
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

    // Race this Task against a deadline. If the deadline passes
    // first, the Task rejects with a shaped timeout error (below).
    // This is cancellation as *stop listening*: the underlying work
    // is not un-happened — a fetch already sent still completes —
    // but its late settlement is ignored, because fork's guard has
    // already settled the race. The timer is unref'd so a pending
    // deadline never keeps the process alive on its own.
    timeout: ms => Task((reject, resolve) => {
      const timer = setTimeout(() => reject(timeoutError(ms)), ms);
      if (timer.unref) timer.unref();
      fork(
        err   => { clearTimeout(timer); reject(err); },
        value => { clearTimeout(timer); resolve(value); }
      );
    }),

    // Re-run this Task when it rejects, waiting between attempts
    // according to the pure delays() schedule: retries extra
    // attempts, baseMs doubling each time. The waiting itself is a
    // Task built on a timer — the impure part stays at the edge.
    retry: (retries, baseMs = 100) => {
      const schedule = delays(retries, baseMs);
      const attempt = n => Task((reject, resolve) => {
        fork(
          err => {
            if (n >= schedule.length) return reject(err);
            wait(schedule[n]).fork(reject, () => attempt(n + 1).fork(reject, resolve));
          },
          resolve
        );
      });
      return attempt(0);
    },
  };
};

Task.of       = x => Task((reject, resolve) => resolve(x));
Task.rejected = x => Task((reject, resolve) => reject(x));

// Task.all — run tasks concurrently, collect results in order.
// Fail-fast: any rejection immediately rejects the outer Task.
// Because every fork is guarded, several failures still settle the
// outer Task exactly once — the first failure wins, the rest are
// ignored. And an empty list resolves immediately: there is nothing
// to wait for.
Task.all = tasks => Task((reject, resolve) => {
  if (tasks.length === 0) return resolve([]);

  const results   = new Array(tasks.length);
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

// A timeout is a domain outcome the shell knows how to send, so it
// arrives already shaped — { status, message } — with a code that
// lets error normalisation recognise it and pass it through, exactly
// like the validation shapes from chapter sixteen.
export const timeoutError = ms => ({
  status:  504,
  code:    'FEED_TIMEOUT',
  message: `Timed out after ${ms} ms`,
});

export const isTimeoutError = err => !!err && err.code === 'FEED_TIMEOUT';

// The retry policy, as a pure function: delays(3, 100) is
// [100, 200, 400] — the waits *between* attempts. Being pure data,
// the schedule can be asserted in a test without waiting for it.
export const delays = (attempts, baseMs) =>
  Array.from({ length: attempts }, (_, i) => baseMs * 2 ** i);

const wait = ms => Task((reject, resolve) => {
  const timer = setTimeout(() => resolve(null), ms);
  if (timer.unref) timer.unref();
});

export default Task;
