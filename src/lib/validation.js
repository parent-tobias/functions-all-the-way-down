export const Success = value => ({
	map:  fn => Success(fn(value)),
	ap:   other => other.map(value), // value is a function, apply it
	fold: (failFn, successFn) => successFn(value),
	isFailure: false,
});

export const Failure = errors => ({
	map: fn => Failure(errors), // Ignore the function, keep the errors
	ap: other => other.isFailure
		? Failure(errors.concat(other.errors)) // Combine errors
		: Failure(errors), // Ignore the success, keep the errors
	fold: (failFn, successFn) => failFn(errors),
	isFailure: true,
	errors,
});

export const Validation = {
	of: value => Success(value),
	Success,
	Failure,
}