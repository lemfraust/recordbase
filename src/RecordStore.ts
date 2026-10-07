import { RecordReader, RecordWriter } from "./RecordOperators";
import { RecordSchema } from "./RecordSchema";
import { RecordTable } from "./RecordTable";

export interface RecordStore<Tables extends readonly RecordTable<any, RecordSchema>[]>
    extends RecordReader<Tables>, RecordWriter<Tables> {

    readonly tables: Tables;

    invalidate(): void;
}