import { RecordData, RecordEntry, RecordPatch } from "./RecordShapes";
import { RecordSchema } from "./RecordSchema";

export class RecordTable<
    const Name extends string,
    const Schema extends RecordSchema
> {
    constructor(
        public readonly name: Name,
        public readonly schema: Schema
    ) { }

    get type(): RecordData<Schema> {
        throw new Error('This is a type helper and should not be used at runtime');
    }
}


export type RecordTableData<Table extends RecordTable<any, any>> =
    Table extends RecordTable<any, infer Schema>
        ? RecordData<Schema>
        : never;

export type RecordTableEntry<Table extends RecordTable<any, any>> =
    Table extends RecordTable<any, infer Schema>
        ? RecordEntry<Schema>
        : never;

export type RecordTablePatch<Table extends RecordTable<any, any>> =
    Table extends RecordTable<any, infer Schema>
        ? RecordPatch<Schema>
        : never;