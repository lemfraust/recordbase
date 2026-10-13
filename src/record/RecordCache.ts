import { RecordEntry, RecordRef } from "./RecordShapes";
import { RecordSchema } from "./RecordSchema";
import { isArray } from "../util";

export interface RecordCache<Schema extends RecordSchema = RecordSchema> {
    readonly auto: boolean;

    readonly count: number;

    complete: boolean;

    records(): Iterable<RecordEntry<Schema>>;

    get(ref: RecordRef): RecordEntry<Schema> | undefined;

    set(entries: RecordEntry<Schema> | readonly RecordEntry<Schema>[]): void;

    clear(ref?: RecordRef): void;
}

export class RecordMemoryCache<Schema extends RecordSchema = RecordSchema> implements RecordCache<Schema> {
    #map = new Map<RecordRef, RecordEntry<Schema>>();

    constructor(readonly auto: boolean) { }

    get count(): number { return this.#map.size; }

    complete: boolean = false;

    records(): Iterable<RecordEntry<Schema>> { return this.#map.values(); }

    get(ref: RecordRef): RecordEntry<Schema> | undefined { return this.#map.get(ref); }

    set(entries: RecordEntry<Schema> | readonly RecordEntry<Schema>[]): void {
        if (isArray(entries))
            entries.forEach(entry => this.#map.set(entry.$ref, entry));
        else
            this.#map.set(entries.$ref, entries);
    }

    clear(ref?: RecordRef): void {
        if (ref !== undefined)
            this.#map.delete(ref);
        else
            this.#map.clear();
    }
}

