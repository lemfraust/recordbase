import { RecordReadOperation, RecordReadResults, RecordWriteOperation, RecordWriteResults } from "./RecordOperations";
import { RecordSchema } from "./RecordSchema";
import { RecordTable } from "./RecordTable";

export interface RecordReader<Tables extends readonly RecordTable<any, RecordSchema>[]> {
    read<const Reads extends readonly RecordReadOperation<Tables[number]>[]>(reads: Reads): Promise<RecordReadResults<Reads>>;
}

export interface RecordWriter<Tables extends readonly RecordTable<any, RecordSchema>[]> {
    write<const Writes extends readonly RecordWriteOperation<Tables[number]>[]>(writes: Writes): Promise<RecordWriteResults<Writes>>;
}

// TODO: Examine simply Read/Write architecture or develop easy helpers (beyond util) for mapping into array and back
export interface RecordStore<Tables extends readonly RecordTable<any, RecordSchema>[]>
    extends RecordReader<Tables>, RecordWriter<Tables> {

    readonly tables: Tables;

    invalidate(): void;
}