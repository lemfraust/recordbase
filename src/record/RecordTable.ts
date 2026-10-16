import { RecordData, RecordEntry, RecordPatch } from "./RecordShapes";
import { RecordSchema, typeOnly } from "./RecordSchema";

export class RecordTable<
    const Name extends string = string,
    const Schema extends RecordSchema = RecordSchema
> {
    constructor(
        public readonly name: Name,
        public readonly schema: Schema
    ) { }

    get type(): RecordData<Schema> {
        return typeOnly();
    }
}

export type RecordTableSchema<Table extends RecordTable> = Table['schema'];

export type RecordTableData<Table extends RecordTable> = RecordData<Table['schema']>;

export type RecordTableEntry<Table extends RecordTable> = RecordEntry<Table['schema']>;

export type RecordTablePatch<Table extends RecordTable> = RecordPatch<Table['schema']>;