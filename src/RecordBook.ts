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
import { RecordEntry, RecordId } from "./RecordShapes";
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
    readonly #counts = new Map<RecordTable<any, RecordSchema>, number>();


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

                cache.complete = false;
                cache.clear();
                cache.set(results[i] as any);
                cache.complete = true;
                this.#counts.set(read.table, cache.count);
            }
        }
    }

    invalidate(): void {

        for (const cache of this.#caches.values()) {
            cache.complete = false;
            cache.clear();
        }

        this.#counts.clear();
    }


    /* Raw read/write */
    async read<const Reads extends readonly RecordReadOperation<Tables[number]>[]>(reads: Reads): Promise<RecordReadResults<Reads>> {
        const results = new Array(reads.length);

        const fetchReads: Reads[number][] = [];
        const fetchIndex: number[] = [];


        for (let i = 0; i < reads.length; i++) {
            const read = reads[i];
            let fetch = false;

            const cache = this.#caches.get(read.table);

            if (read.items === 'all') {
                if (cache?.complete)
                    results[i] = [...cache.records()];
                else
                    fetch = true;
            }
            else if (read.items === 'count') {
                const count = this.#counts.get(read.table);

                if (count !== undefined)
                    results[i] = count;
                else if (cache?.complete) {
                    results[i] = cache.count;
                    this.#counts.set(read.table, cache.count);
                }
                else
                    fetch = true;
            }
            else if ('id' in read.items) {
                const id = read.items.id;

                const result = cache?.get(id);

                if (result)
                    results[i] = result;
                else if (cache?.complete)
                    throw new Error(`Record "${id}" does not exist in table "${read.table.name}"`);
                else
                    fetch = true;
            }
            else {
                const items: RecordEntry<any>[] = [];

                for (const id of read.items.ids) {
                    const result = cache?.get(id);

                    if (result)
                        items.push(result);
                    else if (cache?.complete)
                        throw new Error(`Record "${id}" does not exist in table "${read.table.name}"`);
                    else {
                        fetch = true;
                        break;
                    }
                }

                if (!fetch)
                    results[i] = items;
            }

            if (fetch) {
                fetchReads.push(read);
                fetchIndex.push(i);
            }
        }

        if (fetchReads.length) {
            const fetched = await this.#store.read(fetchReads);

            for (let i = 0; i < fetched.length; i++) {
                const read = fetchReads[i];
                const index = fetchIndex[i];
                results[index] = fetched[i];

                const table = read.table;
                const cache = this.#caches.get(table);


                if (read.items === 'count') {
                    const count = fetched[i] as number;
                    this.#counts.set(table, count);

                    if (cache && cache.count === count)
                        cache.complete = true;
                }
                else if (read.items === 'all') {
                    const records = fetched[i] as RecordEntry<any>[];

                    this.#counts.set(table, records.length);

                    if (cache) {
                        cache.complete = false;
                        cache.clear();
                        cache.set(records);
                        cache.complete = true;
                    }
                }
                else if (cache) {
                    const count = this.#counts.get(table);

                    if ('id' in read.items)
                        cache.set(fetched[i] as RecordEntry<any>);
                    else
                        cache.set(fetched[i] as RecordEntry<any>[]);

                    if (count !== undefined && cache.count === count)
                        cache.complete = true;
                }
            }
        }

        return results as RecordReadResults<Reads>;
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