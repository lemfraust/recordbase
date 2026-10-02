import { RecordEntry, RecordId } from "./RecordShapes";
import { RecordSchema } from "./RecordSchema";

export interface RecordCache<Schema extends RecordSchema> {
    readonly count: number;

    readonly auto: boolean;
    
    records(): Iterable<RecordEntry<Schema>>;

    get(id: RecordId): RecordEntry<Schema> | undefined;

    set(entries: RecordEntry<Schema> | readonly RecordEntry<Schema>[]): void;

    clear(id?: RecordId): void;
}