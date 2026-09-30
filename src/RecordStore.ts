import { RecordId, RecordObject, RecordPatch } from "./RecordObject";
import { RecordSchema } from "./RecordSchema";
import { RecordTable } from "./RecordTable";

export interface RecordStore {
    getOne<Schema extends RecordSchema>(table: RecordTable<any, Schema>, id: RecordId): Promise<RecordObject<Schema> | undefined>;

    getMany<Schema extends RecordSchema>(table: RecordTable<any, Schema>, ids: RecordId[]): Promise<RecordObject<Schema>[]>;

    getAll<Schema extends RecordSchema>(table: RecordTable<any, Schema>): Promise<RecordObject<Schema>[]>;


    addOne<Schema extends RecordSchema>(table: RecordTable<any, Schema>, record: RecordObject<Schema>): Promise<RecordObject<Schema>>;

    addMany<Schema extends RecordSchema>(table: RecordTable<any, Schema>, records: RecordObject<Schema>[]): Promise<RecordObject<Schema>[]>;


    updateOne<Schema extends RecordSchema>(table: RecordTable<any, Schema>, patch: RecordPatch<Schema>): Promise<void>;

    updateMany<Schema extends RecordSchema>(table: RecordTable<any, Schema>, patches: RecordPatch<Schema>[]): Promise<void>;
}