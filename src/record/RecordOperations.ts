import { RecordTable, RecordTableData, RecordTableEntry, RecordTablePatch } from "./RecordSchema";
import { RecordRef } from "./RecordShapes";


/* Return */
export const RecordReturn = Object.freeze({ Ref: 'ref', Data: 'data' } as const);
export type RecordReturnRef = (typeof RecordReturn)['Ref'];
export type RecordReturnData = (typeof RecordReturn)['Data'];
export type RecordReturn = RecordReturnRef | RecordReturnData | undefined;

/* Read */
export type RecordReadItems =
    | { ref: RecordRef; }
    | { refs: readonly RecordRef[]; }
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
> = Items extends 'all' | { refs: readonly RecordRef[]; }
    ? RecordTableEntry<Table>[]
    : RecordTableEntry<Table>;

export type RecordReadResults<Reads extends readonly RecordReadOperation[]> = {
    [Index in keyof Reads]:
    Reads[Index] extends RecordReadOperation<infer Table, infer Items>
    ? RecordReadResult<Table, Items>
    : never;
};

/* Write */

/* Add */
export type RecordAddData<Table extends RecordTable> =
    | RecordTableData<Table>
    | readonly RecordTableData<Table>[];

export type RecordAddOperation<
    Table extends RecordTable = RecordTable,
    Data extends RecordAddData<Table> = RecordAddData<Table>,
    Returns extends RecordReturn = RecordReturn
> = {
    type: 'add';
    table: Table;
    data: Data;
    returns: Returns;
};

export type RecordAddResult<
    Table extends RecordTable,
    Data extends RecordAddData<Table>,
    Returns extends RecordReturn
> =
    Returns extends RecordReturnData
    ? Data extends readonly RecordTableData<Table>[] ? RecordTableEntry<Table>[] : RecordTableEntry<Table>
    : Returns extends RecordReturnRef
    ? Data extends readonly RecordTableData<Table>[] ? RecordRef[] : RecordRef
    : undefined;


/* Update */
export type RecordUpdatePatches<Table extends RecordTable> =
    | RecordTablePatch<Table>
    | readonly RecordTablePatch<Table>[];

export type RecordUpdateOperation<
    Table extends RecordTable = RecordTable,
    Patches extends RecordUpdatePatches<Table> = RecordUpdatePatches<Table>,
    Returns extends RecordReturn = RecordReturn
> = {
    type: 'update';
    table: Table;
    patches: Patches;
    returns: Returns;
};

export type RecordUpdateResult<
    Table extends RecordTable,
    Patches extends RecordUpdatePatches<Table>,
    Returns extends RecordReturn
> =
    Returns extends RecordReturnData
    ? Patches extends readonly RecordTablePatch<Table>[] ? RecordTableEntry<Table>[] : RecordTableEntry<Table>
    : Returns extends RecordReturnRef
    ? Patches extends readonly RecordTablePatch<Table>[] ? RecordRef[] : RecordRef
    : undefined;


/* Operations */
export type RecordWriteOperation<Table extends RecordTable = RecordTable> =
    | RecordAddOperation<Table>
    | RecordUpdateOperation<Table>;

export type RecordWriteResult<Write extends RecordWriteOperation> =
    Write extends RecordAddOperation<infer Table, infer Data, infer Returns>
    ? RecordAddResult<Table, Data, Returns>
    : Write extends RecordUpdateOperation<infer Table, infer Patches, infer Returns>
    ? RecordUpdateResult<Table, Patches, Returns>
    : never;

export type RecordWriteResults<Writes extends readonly RecordWriteOperation[]> = {
    [Index in keyof Writes]:
    Writes[Index] extends RecordWriteOperation
    ? RecordWriteResult<Writes[Index]>
    : never;
};