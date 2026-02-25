// src/lib/either.js
//
// Either represents a value that is one of two things:
//   Right(value) — success, we have what we wanted
//   Left(reason) — failure, here's why
//
// Unlike Maybe's Nothing, Left carries information about what went wrong.

export const Right = x => ({
  map:    fn => Right(fn(x)),
  chain:  fn => fn(x),
  filter: (predicate, leftValue) => predicate(x) ? Right(x) : Left(leftValue),
  getOrElse: _ => x,
  fold:   (leftFn, rightFn) => rightFn(x),
  inspect: () => `Right(${x})`,
});

export const Left = x => ({
  map:    fn => Left(x),
  chain:  fn => Left(x),
  filter: (predicate, leftValue) => Left(x),
  getOrElse: defaultVal => defaultVal,
  fold:   (leftFn, rightFn) => leftFn(x),
  inspect: () => `Left(${x})`,
});

export const Either = {
  // of wraps in Right (success case)
  of: x => Right(x),

  // fromNullable checks for null/undefined; Left carries the error message
  fromNullable: (x, leftValue = 'Value was null') =>
    (x === null || x === undefined) ? Left(leftValue) : Right(x),
};
