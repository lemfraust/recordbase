import { RecordEntry, RecordId } from "./RecordShapes";
import { RecordSchema } from "./RecordSchema";
import { isArray } from "./util";

export interface RecordCache<Schema extends RecordSchema> {
    readonly auto: boolean;

    readonly count: number;

    complete: boolean;

    records(): Iterable<RecordEntry<Schema>>;

    get(id: RecordId): RecordEntry<Schema> | undefined;

    set(entries: RecordEntry<Schema> | readonly RecordEntry<Schema>[]): void;

    clear(id?: RecordId): void;
}

export class RecordMemoryCache<Schema extends RecordSchema> implements RecordCache<Schema> {
    #map = new Map<RecordId, RecordEntry<Schema>>();

    constructor(readonly auto: boolean) { }

    get count(): number { return this.#map.size; }

    complete: boolean = false;

    records(): Iterable<RecordEntry<Schema>> { return this.#map.values(); }

    get(id: RecordId): RecordEntry<Schema> | undefined { return this.#map.get(id); }

    set(entries: RecordEntry<Schema> | readonly RecordEntry<Schema>[]): void {
        if (isArray(entries))
            entries.forEach(entry => this.#map.set(entry.$id, entry));
        else
            this.#map.set(entries.$id, entries)

    }

    clear(id?: RecordId): void {
        if (id)
            this.#map.delete(id);
        else
            this.#map.clear();
    }
}

