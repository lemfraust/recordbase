import {
    RecordReadable,
    RecordReadBuilder,
    RecordWritable,
    RecordWriteBuilder
} from "./RecordOperationBuilders";
import {
    RecordReadOperation,
    RecordReadResults,
    RecordUpdateReturns,
    RecordWriteOperation,
    RecordWriteResults
} from "./RecordOperations";
import { RecordReader, RecordWriter } from "./RecordOperators";
import { RecordCache } from "./RecordCache";
import { RecordSchema } from "./RecordSchema";
import { RecordId } from "./RecordShapes";
import { RecordStore } from "./RecordStore";
import {
    RecordTable,
    RecordTableData,
    RecordTablePatch
} from "./RecordTable";


type RecordTableCache<Table extends RecordTable<any, any>> =
    Table extends RecordTable<any, infer Schema>
    ? RecordCache<Schema>
    : never;


export class RecordBook<const Tables extends readonly RecordTable<any, RecordSchema>[]>
    implements RecordReader<Tables>, RecordWriter<Tables>, RecordReadable<Tables>, RecordWritable<Tables> {

    readonly #store: RecordStore<Tables>;
    readonly #caches = new Map<RecordTable<any, any>, RecordCache<any>>();

    #loaders: readonly RecordReadOperation<Tables[number], 'all'>[] | undefined;

    constructor(store: RecordStore<Tables>) {
        this.#store = store;
    }

    get tables(): Tables {
        return this.#store.tables;
    }


    /* Cache */
    cache<Table extends Tables[number]>(table: Table, cache: RecordTableCache<Table> | null): this {
        if (cache)
            this.#caches.set(table, cache);
        else
            this.#caches.delete(table);

        const loaders: RecordReadOperation<Tables[number], 'all'>[] = [];

        for (const [table, cache] of this.#caches) {
            if (cache.auto)
                loaders.push({ type: 'read', table, items: 'all' });
        }

        this.#loaders = loaders.length ? loaders : undefined;

        return this;
    }

    async load(): Promise<void> {
        const loaders = this.#loaders;

        if (loaders) {

            const results = await this.#store.read(loaders);

            for (let i = 0; i < results.length; i++) {
                const read = loaders[i];
                const cache = this.#caches.get(read.table);

                if (!cache)
                    throw new Error(`Cache for table "${read.table.name}" no longer exists`);

                cache.clear();
                cache.set(results[i] as any);
            }
        }
    }

    invalidate(): void {
        for (const cache of this.#caches.values()) {
            cache.clear();
        }
    }


    /* Raw read/write */
    async read<const Reads extends readonly RecordReadOperation<Tables[number]>[]>(reads: Reads): Promise<RecordReadResults<Reads>> {
        // TODO:
        //
        // 1. inspect attached caches
        // 2. satisfy cache hits
        // 3. construct reduced store reads for misses
        // 4. execute those reads through #store
        // 5. pass fetched entries through their caches
        // 6. reconstruct results in original read order/cardinality
        //
        // getAll may require a store count before deciding whether
        // the currently cached records represent the complete table.

        throw new Error('Not implemented');
    }

    async write<const Writes extends readonly RecordWriteOperation<Tables[number]>[]>(writes: Writes): Promise<RecordWriteResults<Writes>> {
        // TODO:
        //
        // 1. send writes to #store in their original order
        // 2. reconcile successful results with attached caches
        //
        // add:
        //     returned entry/entries -> cache.set(...)
        //
        // update returning 'entry':
        //     returned entry/entries -> cache.set(...)
        //
        // update returning 'id':
        //     only update records already present in the cache
        //     do not fetch cache misses
        //
        // patches containing groups must be merged according to
        // record semantics rather than blindly shallow-spread.

        throw new Error('Not implemented');
    }


    /* Builder factories */
    reader(): RecordReadBuilder<Tables, []> {
        return new RecordReadBuilder<Tables, []>(this, []);
    }

    writer(): RecordWriteBuilder<Tables, []> {
        return new RecordWriteBuilder<Tables, []>(this, []);
    }


    /* Fluent reads */
    getOne<Table extends Tables[number]>(table: Table, id: RecordId) {
        return this.reader().getOne(table, id);
    }

    getMany<Table extends Tables[number]>(table: Table, ids: readonly RecordId[]) {
        return this.reader().getMany(table, ids);
    }

    getAll<Table extends Tables[number]>(table: Table) {
        return this.reader().getAll(table);
    }

    count<Table extends Tables[number]>(table: Table) {
        return this.reader().count(table);
    }


    /* Fluent writes */
    addOne<Table extends Tables[number]>(table: Table, data: RecordTableData<Table>) {
        return this.writer().addOne(table, data);
    }

    addMany<Table extends Tables[number]>(table: Table, data: readonly RecordTableData<Table>[]) {
        return this.writer().addMany(table, data);
    }

    updateOne<Table extends Tables[number], Returns extends RecordUpdateReturns = 'id'>(table: Table, patch: RecordTablePatch<Table>, returns?: Returns) {
        return this.writer().updateOne(table, patch, returns);
    }

    updateMany<Table extends Tables[number], Returns extends RecordUpdateReturns = 'id'>(table: Table, patches: readonly RecordTablePatch<Table>[], returns?: Returns) {
        return this.writer().updateMany(table, patches, returns);
    }
}