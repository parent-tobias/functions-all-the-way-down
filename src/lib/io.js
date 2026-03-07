// /src/lib/io.js
//
// IO represents a side-effectful computation that can be executed later.
// Like Task, IO is LAZY — nothing runs until you call .run().

export const IO = fn => ({
	map: fn2 => IO(() => fn2(fn())),
	chain: fn2 => IO(() => fn2(fn()).run()),
	run: () => fn(),
})

IO.of = value => IO(() => value);

export default IO;