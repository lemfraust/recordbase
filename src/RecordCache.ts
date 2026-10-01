import { RecordEntry, RecordId } from "./RecordShapes";
import { RecordSchema } from "./RecordSchema";

export interface RecordCache<Schema extends RecordSchema> {
    readonly count: number;

    get(id: RecordId): RecordEntry<Schema> | undefined;

    records(): Iterable<RecordEntry<Schema>>;

    set(entry: RecordEntry<Schema>): void;

    clear(id?: RecordId): void;
}