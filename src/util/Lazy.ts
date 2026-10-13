export type Promisable<T> = T | Promise<T>

export type Thunkable<T> = T | (() => T);

export type Resolvable<T> = Thunkable<Promisable<T>>

export class Lazy<T> implements PromiseLike<T> {
    #source: () => Promisable<T>;
    #promise?: Promise<T>;
    #resolved: boolean = false;

    constructor(source: Resolvable<T>) {
        this.#source = typeof source === 'function'
            ? source as () => T | Promise<T>
            : () => source;
    }

    get resolved() { return this.#resolved; }

    value(): Promise<T> {
        return this.#promise ??= Promise
            .resolve()
            .then(() => this.#source())
            .then(value => { this.#resolved = true; return value; })
            .catch(error => { this.#promise = undefined; throw error; });
    }

    then<Fulfilled = T, Rejected = never>(
        onfulfilled?: ((value: T) => Fulfilled | PromiseLike<Fulfilled>) | null | undefined,
        onrejected?: ((reason: any) => Rejected | PromiseLike<Rejected>) | null | undefined
    ): PromiseLike<Fulfilled | Rejected> {
        return this.value().then(onfulfilled, onrejected);
    }
}

export const lazy = <T>(source: Resolvable<T>): Lazy<T> => new Lazy<T>(source);
