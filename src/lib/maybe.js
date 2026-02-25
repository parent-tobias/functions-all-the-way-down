// src/lib/maybe.js
//
// Maybe represents a value that might not exist.
// Instead of null checks everywhere, wrap once and operate safely.
//
// Just  — a box holding a value
// Nothing — an empty box
// Both have the same interface, different behaviour.

export const Just = x => ({
  map:      fn => Just(fn(x)),
  chain:    fn => fn(x),
  filter:   fn => fn(x) ? Just(x) : Nothing(),
  getOrElse: _  => x,
  inspect:  () => `Just(${x})`,
});

export const Nothing = () => ({
  map:      fn => Nothing(),
  chain:    fn => Nothing(),
  filter:   fn => Nothing(),
  getOrElse: defaultVal => defaultVal,
  inspect:  () => 'Nothing',
});

// Maybe.of — the smart constructor.
// Wraps a value in Just, but if the value is null/undefined returns Nothing.
export const Maybe = {
  of:      x => (x === null || x === undefined) ? Nothing() : Just(x),
  nothing: () => Nothing(),
};
