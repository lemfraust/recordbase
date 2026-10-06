export const isArray = <T>(value: T | readonly T[]): value is readonly T[] => Array.isArray(value);

export type Simplify<Type> = { [Key in keyof Type]: Type[Key] };
