export type Simplify<Type> = { [Key in keyof Type]: Type[Key] };

export type Promisable<T> = T | Promise<T>

export type Thunkable<T> = T | (() => T);

export type Resolvable<T> = Thunkable<Promisable<T>>

export type Append<Values extends readonly unknown[], Value> = readonly [...Values, Value];
