import {
    RecordAddOperation, RecordReadOperation, RecordReadResults, RecordUpdateOperation,
    RecordUpdateReturns, RecordWriteOperation, RecordWriteResults
} from "./RecordOperations";
import { RecordSchema } from "./RecordSchema";
import { RecordId } from "./RecordShapes";
import { RecordReader, RecordWriter } from "./RecordStore";
import { RecordTable, RecordTableData, RecordTablePatch } from "./RecordTable";


type RecordBuilderResult<Results extends readonly unknown[]> =
    Results extends readonly [infer Result]
    ? Result
    : Results;

export type RecordReadBuilderResult<Reads extends readonly RecordReadOperation<any, any>[]> =
    RecordBuilderResult<RecordReadResults<Reads>>;

export type RecordWriteBuilderResult<Writes extends readonly RecordWriteOperation<any>[]> =
    RecordBuilderResult<RecordWriteResults<Writes>>;


/* Read */
export interface RecordReadable<
    Tables extends readonly RecordTable<any, RecordSchema>[],
    Reads extends readonly RecordReadOperation<Tables[number], any>[] = []
> {
    getOne<Table extends Tables[number]>(table: Table, id: RecordId): RecordReadBuilder<Tables, readonly [...Reads, RecordReadOperation<Table, { id: RecordId; }>]>;

    getMany<Table extends Tables[number]>(table: Table, ids: readonly RecordId[]): RecordReadBuilder<Tables, readonly [...Reads, RecordReadOperation<Table, { ids: readonly RecordId[]; }>]>;

    getAll<Table extends Tables[number]>(table: Table): RecordReadBuilder<Tables, readonly [...Reads, RecordReadOperation<Table, 'all'>]>;

    count<Table extends Tables[number]>(table: Table): RecordReadBuilder<Tables, readonly [...Reads, RecordReadOperation<Table, 'count'>]>;
}

const freeze = <T>(t: T) => Object.freeze(t);

export class RecordReadBuilder<
    Tables extends readonly RecordTable<any, RecordSchema>[],
    Reads extends readonly RecordReadOperation<Tables[number], any>[]
> implements RecordReadable<Tables, Reads>, PromiseLike<RecordReadBuilderResult<Reads>> {
    readonly reader: RecordReader<Tables>;
    readonly reads: Reads;

    constructor(reader: RecordReader<Tables>, reads: Reads) {
        this.reader = reader;
        this.reads = Object.isFrozen(reads) ? reads : freeze([...reads]) as Reads;
    }

    getOne<Table extends Tables[number]>(table: Table, id: RecordId): RecordReadBuilder<Tables, readonly [...Reads, RecordReadOperation<Table, { id: RecordId; }>]> {
        return new RecordReadBuilder(this.reader, freeze([
            ...this.reads,
            freeze({ type: 'read', table, items: freeze({ id }) })
        ]) as readonly [...Reads, RecordReadOperation<Table, { id: RecordId; }>]);
    }

    getMany<Table extends Tables[number]>(table: Table, ids: readonly RecordId[]): RecordReadBuilder<Tables, readonly [...Reads, RecordReadOperation<Table, { ids: readonly RecordId[]; }>]> {
        return new RecordReadBuilder(this.reader, freeze([
            ...this.reads,
            freeze({ type: 'read', table, items: freeze({ ids: freeze([...ids]) }) })
        ]) as readonly [...Reads, RecordReadOperation<Table, { ids: readonly RecordId[]; }>]);
    }

    getAll<Table extends Tables[number]>(table: Table): RecordReadBuilder<Tables, readonly [...Reads, RecordReadOperation<Table, 'all'>]> {
        return new RecordReadBuilder(this.reader, freeze([
            ...this.reads,
            freeze({ type: 'read', table, items: 'all' })
        ]) as readonly [...Reads, RecordReadOperation<Table, 'all'>]);
    }

    count<Table extends Tables[number]>(table: Table): RecordReadBuilder<Tables, readonly [...Reads, RecordReadOperation<Table, 'count'>]> {
        return new RecordReadBuilder(this.reader, freeze([
            ...this.reads,
            freeze({ type: 'read', table, items: 'count' })
        ]) as readonly [...Reads, RecordReadOperation<Table, 'count'>]);
    }

    with(reader: RecordReader<Tables>) {
        return new RecordReadBuilder<Tables, Reads>(reader, this.reads);
    }

    then<TResult1 = RecordReadBuilderResult<Reads>, TResult2 = never>(
        onfulfilled?: ((value: RecordReadBuilderResult<Reads>) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
        return this.reader.read(this.reads)
            .then(results =>
                (results.length === 1 ? results[0] : results) as RecordReadBuilderResult<Reads>
            )
            .then(onfulfilled, onrejected);
    }
}


/* Write */

export interface RecordWritable<
    Tables extends readonly RecordTable<any, RecordSchema>[],
    Writes extends readonly RecordWriteOperation<Tables[number]>[] = []
> {
    addOne<Table extends Tables[number]>(table: Table, data: RecordTableData<Table>): RecordWriteBuilder<Tables, readonly [...Writes, RecordAddOperation<Table, RecordTableData<Table>>]>;

    addMany<Table extends Tables[number]>(table: Table, data: readonly RecordTableData<Table>[]): RecordWriteBuilder<Tables, readonly [...Writes, RecordAddOperation<Table, readonly RecordTableData<Table>[]>]>;

    updateOne<Table extends Tables[number], Returns extends RecordUpdateReturns = 'id'>(table: Table, patch: RecordTablePatch<Table>, returns?: Returns): RecordWriteBuilder<Tables, readonly [...Writes, RecordUpdateOperation<Table, RecordTablePatch<Table>, Returns>]>;

    updateMany<Table extends Tables[number], Returns extends RecordUpdateReturns = 'id'>(table: Table, patches: readonly RecordTablePatch<Table>[], returns?: Returns): RecordWriteBuilder<Tables, readonly [...Writes, RecordUpdateOperation<Table, readonly RecordTablePatch<Table>[], Returns>]>;
}

export class RecordWriteBuilder<
    Tables extends readonly RecordTable<any, RecordSchema>[],
    Writes extends readonly RecordWriteOperation<Tables[number]>[]
> implements RecordWritable<Tables, Writes>, PromiseLike<RecordWriteBuilderResult<Writes>> {
    readonly writer: RecordWriter<Tables>;
    readonly writes: Writes;

    constructor(writer: RecordWriter<Tables>, writes: Writes) {
        this.writer = writer;
        this.writes = Object.isFrozen(writes) ? writes : freeze([...writes]) as Writes;
    }

    addOne<Table extends Tables[number]>(table: Table, data: RecordTableData<Table>): RecordWriteBuilder<Tables, readonly [...Writes, RecordAddOperation<Table, RecordTableData<Table>>]> {
        return new RecordWriteBuilder(this.writer, freeze([
            ...this.writes,
            freeze({ type: 'add', table, data })
        ]) as readonly [...Writes, RecordAddOperation<Table, RecordTableData<Table>>]);
    }

    addMany<Table extends Tables[number]>(table: Table, data: readonly RecordTableData<Table>[]): RecordWriteBuilder<Tables, readonly [...Writes, RecordAddOperation<Table, readonly RecordTableData<Table>[]>]> {
        return new RecordWriteBuilder(this.writer, freeze([
            ...this.writes,
            freeze({ type: 'add', table, data: freeze([...data]) })
        ]) as readonly [...Writes, RecordAddOperation<Table, readonly RecordTableData<Table>[]>]);
    }

    updateOne<Table extends Tables[number], Returns extends RecordUpdateReturns = 'id'>(table: Table, patch: RecordTablePatch<Table>, returns: Returns = 'id' as Returns): RecordWriteBuilder<Tables, readonly [...Writes, RecordUpdateOperation<Table, RecordTablePatch<Table>, Returns>]> {
        return new RecordWriteBuilder(this.writer, freeze([
            ...this.writes,
            freeze({ type: 'update', table, patches: patch, returns })
        ]) as readonly [...Writes, RecordUpdateOperation<Table, RecordTablePatch<Table>, Returns>]);
    }

    updateMany<Table extends Tables[number], Returns extends RecordUpdateReturns = 'id'>(table: Table, patches: readonly RecordTablePatch<Table>[], returns: Returns = 'id' as Returns): RecordWriteBuilder<Tables, readonly [...Writes, RecordUpdateOperation<Table, readonly RecordTablePatch<Table>[], Returns>]> {
        return new RecordWriteBuilder(this.writer, freeze([
            ...this.writes,
            freeze({ type: 'update', table, patches: freeze([...patches]), returns })
        ]) as readonly [...Writes, RecordUpdateOperation<Table, readonly RecordTablePatch<Table>[], Returns>]);
    }

    with(writer: RecordWriter<Tables>) {
        return new RecordWriteBuilder<Tables, Writes>(writer, this.writes);
    }

    then<TResult1 = RecordWriteBuilderResult<Writes>, TResult2 = never>(
        onfulfilled?: ((value: RecordWriteBuilderResult<Writes>) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
        return this.writer.write(this.writes)
            .then(results =>
                (results.length === 1 ? results[0] : results) as RecordWriteBuilderResult<Writes>
            )
            .then(onfulfilled, onrejected);
    }
}