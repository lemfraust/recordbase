import {
    RecordAddOperation, RecordReadOperation, RecordReadResult, RecordReadResults, RecordUpdateOperation,
    RecordUpdateResult,
    RecordUpdateReturns, RecordWriteOperation, RecordWriteResult, RecordWriteResults
} from "./RecordOperations";
import { RecordId } from "./RecordShapes";
import { RecordReader, RecordWriter } from "./RecordStore";
import { RecordTable, RecordTableData, RecordTableEntry, RecordTablePatch } from "./RecordTable";
import { Append, freeze } from "./util";

/* Returns */
type RecordBuilderResult<Results extends readonly unknown[]> =
    Results extends readonly [infer Result]
    ? Result
    : Results;

export type RecordReadBuilderResult<Reads extends readonly RecordReadOperation<any, any>[]> =
    RecordBuilderResult<RecordReadResults<Reads>>;

export type RecordWriteBuilderResult<Writes extends readonly RecordWriteOperation<any>[]> =
    RecordBuilderResult<RecordWriteResults<Writes>>;


/* Interfaces */
export interface RecordReadable<
    Tables extends readonly RecordTable[],
    Results extends readonly unknown[] = []
> {
    getOne<Table extends Tables[number]>(table: Table, id: RecordId)
        : RecordReadableExecutable<Tables, Append<Results, RecordTableEntry<Table>>>;

    getMany<Table extends Tables[number]>(table: Table, ids: readonly RecordId[])
        : RecordReadableExecutable<Tables, Append<Results, RecordTableEntry<Table>[]>>;

    getAll<Table extends Tables[number]>(table: Table)
        : RecordReadableExecutable<Tables, Append<Results, RecordTableEntry<Table>[]>>;

    count<Table extends Tables[number]>(table: Table)
        : RecordReadableExecutable<Tables, Append<Results, number>>;
}

export interface RecordReadableExecutable<
    Tables extends readonly RecordTable[],
    Results extends readonly unknown[] = []
> extends RecordReadable<Tables, Results>, PromiseLike<RecordBuilderResult<Results>> {
    readonly reads: readonly RecordReadOperation<Tables[number]>[];
}

export interface RecordWritable<
    Tables extends readonly RecordTable[],
    Results extends readonly unknown[] = []
> {
    addOne<Table extends Tables[number]>(table: Table, data: RecordTableData<Table>)
        : RecordWritableExecutable<Tables, Append<Results, RecordTableEntry<Table>>>;

    addMany<Table extends Tables[number]>(table: Table, data: readonly RecordTableData<Table>[])
        : RecordWritableExecutable<Tables, Append<Results, RecordTableEntry<Table>[]>>;

    updateOne<Table extends Tables[number], Returns extends RecordUpdateReturns>
        (table: Table, patch: RecordTablePatch<Table>, returns: Returns)
        : RecordWritableExecutable<Tables, Append<Results, RecordUpdateResult<Table, RecordTablePatch<Table>, Returns>>>;

    updateMany<Table extends Tables[number], Returns extends RecordUpdateReturns>
        (table: Table, patches: readonly RecordTablePatch<Table>[], returns: Returns)
        : RecordWritableExecutable<Tables, Append<Results, RecordUpdateResult<Table, readonly RecordTablePatch<Table>[], Returns>>>;
}

export interface RecordWritableExecutable<
    Tables extends readonly RecordTable[],
    Results extends readonly unknown[] = []
> extends RecordWritable<Tables, Results>, PromiseLike<RecordBuilderResult<Results>> {
    readonly writes: readonly RecordWriteOperation<Tables[number]>[];
}



/* Builders */
export class RecordReadBuilder<
    Tables extends readonly RecordTable[],
    Results extends readonly unknown[] = []
> implements RecordReadable<Tables, Results>, PromiseLike<RecordBuilderResult<Results>> {
    readonly reader: RecordReader<Tables>;
    readonly reads: readonly RecordReadOperation<Tables[number]>[];

    constructor(reader: RecordReader<Tables>, reads: readonly RecordReadOperation<Tables[number]>[]) {
        this.reader = reader;
        this.reads = Object.isFrozen(reads) ? reads : freeze([...reads]);
    }

    #append<Read extends RecordReadOperation<Tables[number]>>(read: Read)
        : RecordReadBuilder<Tables, Append<Results, RecordReadResult<Read['table'], Read['items']>>> {
        return new RecordReadBuilder(
            this.reader,
            freeze([...this.reads, read])
        );
    }

    getOne<Table extends Tables[number]>(table: Table, id: RecordId) {
        return this.#append(freeze({ type: 'read', table, items: freeze({ id }) }));
    }

    getMany<Table extends Tables[number]>(table: Table, ids: readonly RecordId[]) {
        return this.#append(freeze({ type: 'read', table, items: freeze({ ids: freeze([...ids]) }) }));
    }

    getAll<Table extends Tables[number]>(table: Table) {
        return this.#append(freeze({ type: 'read', table, items: 'all' }));
    }

    count<Table extends Tables[number]>(table: Table) {
        return this.#append(freeze({ type: 'read', table, items: 'count' }));
    }

    with(reader: RecordReader<Tables>) {
        return new RecordReadBuilder<Tables, Results>(reader, this.reads);
    }

    then<Fulfilled = RecordBuilderResult<Results>, Rejected = never>(
        onfulfilled?: ((value: RecordBuilderResult<Results>) => Fulfilled | PromiseLike<Fulfilled>) | null,
        onrejected?: ((reason: any) => Rejected | PromiseLike<Rejected>) | null
    ): Promise<Fulfilled | Rejected> {
        return this.reader.read(this.reads)
            .then(results =>
                (results.length === 1 ? results[0] : results) as RecordBuilderResult<Results>
            )
            .then(onfulfilled, onrejected);
    }
}

export class RecordWriteBuilder<
    Tables extends readonly RecordTable[],
    Results extends readonly unknown[] = []
> implements RecordWritableExecutable<Tables, Results> {
    readonly writer: RecordWriter<Tables>;
    readonly writes: readonly RecordWriteOperation<Tables[number]>[];

    constructor(writer: RecordWriter<Tables>, writes: readonly RecordWriteOperation<Tables[number]>[]) {
        this.writer = writer;
        this.writes = Object.isFrozen(writes) ? writes : freeze([...writes]);
    }

    #append<Result>(
        write: RecordWriteOperation<Tables[number]>
    ): RecordWriteBuilder<Tables, Append<Results, Result>> {
        return new RecordWriteBuilder(
            this.writer,
            freeze([...this.writes, write])
        );
    }

    addOne<Table extends Tables[number]>(table: Table, data: RecordTableData<Table>) {
        return this.#append<RecordTableEntry<Table>>(
            freeze({ type: 'add', table, data })
        );
    }

    addMany<Table extends Tables[number]>(table: Table, data: readonly RecordTableData<Table>[]) {
        return this.#append<RecordTableEntry<Table>[]>(
            freeze({ type: 'add', table, data: freeze([...data]) })
        );
    }

    updateOne<Table extends Tables[number], Returns extends RecordUpdateReturns>
        (table: Table, patch: RecordTablePatch<Table>, returns: Returns)
        : RecordWritableExecutable<Tables, Append<Results, RecordUpdateResult<Table, RecordTablePatch<Table>, Returns>>> {
        return this.#append(freeze({ type: 'update', table, patches: patch, returns }));
    }

    updateMany<Table extends Tables[number], Returns extends RecordUpdateReturns>
        (table: Table, patches: readonly RecordTablePatch<Table>[], returns: Returns)
        : RecordWritableExecutable<Tables, Append<Results, RecordUpdateResult<Table, readonly RecordTablePatch<Table>[], Returns>>> {
        return this.#append(freeze({ type: 'update', table, patches: freeze([...patches]), returns }));
    }

    with(writer: RecordWriter<Tables>) {
        return new RecordWriteBuilder<Tables, Results>(writer, this.writes);
    }

    then<Fulfilled = RecordBuilderResult<Results>, Rejected = never>(
        onfulfilled?: ((value: RecordBuilderResult<Results>) => Fulfilled | PromiseLike<Fulfilled>) | null,
        onrejected?: ((reason: any) => Rejected | PromiseLike<Rejected>) | null
    ): Promise<Fulfilled | Rejected> {
        return this.writer.write(this.writes)
            .then(results =>
                (results.length === 1 ? results[0] : results) as RecordBuilderResult<Results>
            )
            .then(onfulfilled, onrejected);
    }
}