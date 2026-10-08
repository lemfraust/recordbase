import { RecordId } from "./RecordShapes";
import { RecordTable, RecordTableData, RecordTableEntry, RecordTablePatch } from "./RecordTable";


/* Read */
export type RecordReadItems =
    | { id: RecordId; }
    | { ids: readonly RecordId[]; }
    | 'all'
    | 'count';

export type RecordReadOperation<
    Table extends RecordTable<any, any>,
    Items extends RecordReadItems = RecordReadItems
> = {
    type: 'read';
    table: Table;
    items: Items;
};

export type RecordReadResult<
    Table extends RecordTable<any, any>,
    Items extends RecordReadItems
> =
    Items extends 'count'
        ? number
        : Items extends 'all' | {ids: readonly RecordId[] }
            ? RecordTableEntry<Table>[]
            : RecordTableEntry<Table>;

export type RecordReadResults<Reads extends readonly RecordReadOperation<any, any>[]> = {
    [Index in keyof Reads]:
        Reads[Index] extends RecordReadOperation<infer Table, infer Items>
            ? RecordReadResult<Table, Items>
            : never;
};


/* Add */
export type RecordAddData<Table extends RecordTable<any, any>> =
    RecordTableData<Table> | readonly RecordTableData<Table>[];

export type RecordAddOperation<
    Table extends RecordTable<any, any>,
    Data extends RecordAddData<Table> = RecordAddData<Table>
> = {
    type: 'add';
    table: Table;
    data: Data;
};

export type RecordAddResult<
    Table extends RecordTable<any, any>,
    Data extends RecordAddData<Table>
> =
    Data extends readonly RecordTableData<Table>[]
        ? RecordTableEntry<Table>[]
        : RecordTableEntry<Table>;


/* Update */
export type RecordUpdatePatches<Table extends RecordTable<any, any>> =
    RecordTablePatch<Table> | readonly RecordTablePatch<Table>[];

export type RecordUpdateReturns = 'id' | 'entry';

export type RecordUpdateOperation<
    Table extends RecordTable<any, any>,
    Patches extends RecordUpdatePatches<Table>,
    Returns extends RecordUpdateReturns
> = {
    type: 'update';
    table: Table;
    patches: Patches;
    returns: Returns;
};

export type RecordUpdateResult<
    Table extends RecordTable<any, any>,
    Patches extends RecordUpdatePatches<Table>,
    Returns extends RecordUpdateReturns
> =
    Returns extends 'entry'
        ? Patches extends readonly RecordTablePatch<Table>[] ? RecordTableEntry<Table>[] : RecordTableEntry<Table>
        : Patches extends readonly RecordTablePatch<Table>[] ? RecordId[] : RecordId;


/* Write */
export type RecordWriteOperation<Table extends RecordTable<any, any>> =
    | RecordAddOperation<Table>
    | RecordUpdateOperation<Table, RecordUpdatePatches<Table>, RecordUpdateReturns>;

export type RecordWriteResult<Write extends RecordWriteOperation<any>> =
    Write extends RecordAddOperation<infer Table, infer Data>
        ? RecordAddResult<Table, Data>
        : Write extends RecordUpdateOperation<infer Table, infer Patches, infer Returns>
            ? RecordUpdateResult<Table, Patches, Returns>
            : never;

export type RecordWriteResults<Writes extends readonly RecordWriteOperation<any>[]> = {
    [Index in keyof Writes]:
        Writes[Index] extends RecordWriteOperation<any>
            ? RecordWriteResult<Writes[Index]>
            : never;
};