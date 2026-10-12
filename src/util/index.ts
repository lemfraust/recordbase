export type Simplify<Type> = { [Key in keyof Type]: Type[Key] };

export type Append<Values extends readonly unknown[], Value> = readonly [...Values, Value];


export const isArray = <T>(value: T | readonly T[]): value is readonly T[] => Array.isArray(value);

export const toArray = <T>(value: T | readonly T[]): readonly T[] => isArray(value) ? value : [value];

export const toLength = <T>(value: T | readonly T[]): number=> isArray(value) ? value.length : 1;

export const freeze = <T>(value: T) => Object.freeze(value);
