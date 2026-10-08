import { RecordId } from "./RecordShapes";
import { RecordTable, RecordTableData, RecordTableEntry, RecordTablePatch } from "./RecordTable";


/* Read */
export type RecordReadItems =
    | { id: RecordId; }
    | { ids: readonly RecordId[]; }
    | 'all';

export type RecordReadOperation<
    Table extends RecordTable = RecordTable,
    Items extends RecordReadItems = RecordReadItems
> = {
    type: 'read';
    table: Table;
    items: Items;
};

export type RecordReadResult<
    Table extends RecordTable,
    Items extends RecordReadItems
> =
    Items extends 'count'
        ? number
        : Items extends 'all' | { ids: readonly RecordId[]; }
            ? RecordTableEntry<Table>[]
            : RecordTableEntry<Table>;

export type RecordReadResults<Reads extends readonly RecordReadOperation[]> = {
    [Index in keyof Reads]:
        Reads[Index] extends RecordReadOperation<infer Table, infer Items>
            ? RecordReadResult<Table, Items>
            : never;
};


/* Add */
export type RecordAddData<Table extends RecordTable> =
    | RecordTableData<Table>
    | readonly RecordTableData<Table>[];

export type RecordAddOperation<
    Table extends RecordTable = RecordTable,
    Data extends RecordAddData<Table> = RecordAddData<Table>
> = {
    type: 'add';
    table: Table;
    data: Data;
};

export type RecordAddResult<
    Table extends RecordTable,
    Data extends RecordAddData<Table>
> =
    Data extends readonly RecordTableData<Table>[]
        ? RecordTableEntry<Table>[]
        : RecordTableEntry<Table>;


/* Update */
export type RecordUpdatePatches<Table extends RecordTable> =
    | RecordTablePatch<Table>
    | readonly RecordTablePatch<Table>[];

export type RecordUpdateReturns = 'id' | 'entry';

export type RecordUpdateOperation<
    Table extends RecordTable = RecordTable,
    Patches extends RecordUpdatePatches<Table> = RecordUpdatePatches<Table>,
    Returns extends RecordUpdateReturns = RecordUpdateReturns
> = {
    type: 'update';
    table: Table;
    patches: Patches;
    returns: Returns;
};

export type RecordUpdateResult<
    Table extends RecordTable,
    Patches extends RecordUpdatePatches<Table>,
    Returns extends RecordUpdateReturns
> =
    Returns extends 'entry'
        ? Patches extends readonly RecordTablePatch<Table>[] ? RecordTableEntry<Table>[] : RecordTableEntry<Table>
        : Patches extends readonly RecordTablePatch<Table>[] ? RecordId[] : RecordId;


/* Write */
export type RecordWriteOperation<Table extends RecordTable = RecordTable> =
    | RecordAddOperation<Table>
    | RecordUpdateOperation<Table>;

export type RecordWriteResult<Write extends RecordWriteOperation> =
    Write extends RecordAddOperation<infer Table, infer Data>
        ? RecordAddResult<Table, Data>
        : Write extends RecordUpdateOperation<infer Table, infer Patches, infer Returns>
            ? RecordUpdateResult<Table, Patches, Returns>
            : never;

export type RecordWriteResults<Writes extends readonly RecordWriteOperation[]> = {
    [Index in keyof Writes]:
        Writes[Index] extends RecordWriteOperation
            ? RecordWriteResult<Writes[Index]>
            : never;
};