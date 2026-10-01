import { RecordData, RecordEntry, RecordId, RecordPatch } from "./RecordShapes";
import { RecordSchema } from "./RecordSchema";
import { RecordTable } from "./RecordTable";

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

export interface RecordStore<Tables extends readonly RecordTable<any, RecordSchema>[]> {
    readonly tables: Tables;

    count<Table extends Tables[number]>(table: Table): Promise<number>;


    getOne<Table extends Tables[number]>(table: Table, id: RecordId): Promise<RecordTableEntry<Table> | undefined>;

    getMany<Table extends Tables[number]>(table: Table, ids: RecordId[]): Promise<RecordTableEntry<Table>[]>;

    getAll<Table extends Tables[number]>(table: Table): Promise<RecordTableEntry<Table>[]>;


    addOne<Table extends Tables[number]>(table: Table, data: RecordTableData<Table>): Promise<RecordTableEntry<Table>>;

    addMany<Table extends Tables[number]>(table: Table, data: RecordTableData<Table>[]): Promise<RecordTableEntry<Table>[]>;


    updateOne<Table extends Tables[number]>(table: Table, patch: RecordTablePatch<Table>): Promise<void>;

    updateMany<Table extends Tables[number]>(table: Table, patches: RecordTablePatch<Table>[]): Promise<void>;
}