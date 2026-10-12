import { RecordReadable, RecordReadBuilder, RecordWritable, RecordWritableExecutable, RecordWriteBuilder } from "./RecordOperationBuilders";
import { RecordAddResult, RecordReadOperation, RecordReadResults, RecordUpdateResult, RecordWriteOperation, RecordWriteResults, RecordReturn } from "./RecordOperations";
import { RecordCache, RecordMemoryCache } from "./RecordCache";
import { RecordElement } from "./RecordSchema";
import { RecordEntry } from "./RecordShapes";
import { RecordReader, RecordStore, RecordWriter } from "./RecordStore";
import { RecordTable, RecordTableData, RecordTableEntry, RecordTablePatch, RecordTableSchema } from "./RecordTable";
import { isArray } from "./util";
import { RecordRef } from "./RecordShapes";

export type RecordCacheConfig = { auto: boolean; };

export type RecordCacheFactory<Table extends RecordTable> = (table: Table) => RecordCache<RecordTableSchema<Table>>;

export class RecordBook<const Tables extends readonly RecordTable[]>
    implements RecordReader<Tables>, RecordWriter<Tables>, RecordReadable<Tables>, RecordWritable<Tables> {

    readonly #store: RecordStore<Tables>;
    readonly #caches = new Map<RecordTable, RecordCache>();

    #loaders: readonly RecordReadOperation<Tables[number], 'all'>[] | undefined;

    constructor(store: RecordStore<Tables>) {
        this.#store = store;
    }

    get tables(): Tables {
        return this.#store.tables;
    }


    /* Cache */
    cache<Table extends Tables[number]>(table: Table, cache: RecordCacheConfig | RecordCacheFactory<Table> | null): this {
        if (cache === null)
            this.#caches.delete(table);
        else if (typeof cache === 'function')
            this.#caches.set(table, cache(table));
        else
            this.#caches.set(table, new RecordMemoryCache<RecordTableSchema<Table>>(cache.auto));

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
            }
        }
    }

    invalidate(): void {
        for (const cache of this.#caches.values()) {
            cache.complete = false;
            cache.clear();
        }

        this.#store.invalidate();
    }


    /* Raw read/write */
    // TODO: Refactor more
    // TODO: Look into concurrent cache operations with revisions
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
            else if ('ref' in read.items) {
                const ref = read.items.ref;

                const result = cache?.get(ref);

                if (result)
                    results[i] = result;
                else if (cache?.complete)
                    throw new Error(this.#missingCacheRecord(ref, read.table.name));
                else
                    fetch = true;
            }
            else {
                const items: RecordEntry<any>[] = [];

                for (const ref of read.items.refs) {
                    const result = cache?.get(ref);

                    if (result)
                        items.push(result);
                    else if (cache?.complete)
                        throw new Error(this.#missingCacheRecord(ref, read.table.name));
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


                if (read.items === 'all') {
                    const records = fetched[i] as RecordEntry<any>[];

                    if (cache) {
                        cache.complete = false;
                        cache.clear();
                        cache.set(records);
                        cache.complete = true;
                    }
                }
                else if (cache) {
                    if ('ref' in read.items)
                        cache.set(fetched[i] as RecordEntry<any>);
                    else
                        cache.set(fetched[i] as RecordEntry<any>[]);
                }
            }
        }

        return results as RecordReadResults<Reads>;
    }

    async write<const Writes extends readonly RecordWriteOperation<Tables[number]>[]>
        (writes: Writes)
        : Promise<RecordWriteResults<Writes>> {

        const results = await this.#store.write(writes);

        for (let index = 0; index < writes.length; index++) {
            const write = writes[index];
            const result = results[index];

            const cache = this.#caches.get(write.table) as
                | RecordCache<RecordTableSchema<typeof write.table>>
                | undefined;

            if (cache) {
                let complete = cache.complete;

                // Add
                if (write.type === 'add') {
                    if (isArray(write.data) && write.data.length === 0)
                        continue;

                    if (write.returns === RecordReturn.Data) {
                        const entries = (Array.isArray(result) ? result : [result]) as RecordTableEntry<typeof write.table>[];

                        cache.set(entries);
                    }
                    else if (write.returns === RecordReturn.Ref) {
                        const data = isArray(write.data)
                            ? write.data
                            : [write.data];

                        const refs = (
                            Array.isArray(result)
                                ? result
                                : [result]
                        ) as RecordRef[];

                        const entries = data.map((data, index) => ({
                            ...data,
                            $ref: refs[index]
                        })) as RecordTableEntry<typeof write.table>[];

                        cache.set(entries);
                    }
                    else {
                        complete = false;
                    }
                }

                // Update
                else if (write.type === 'update') {
                    const patches = isArray(write.patches)
                        ? write.patches
                        : [write.patches];

                    if (write.returns === RecordReturn.Data) {
                        const entries = (
                            Array.isArray(result)
                                ? result
                                : [result]
                        ) as RecordTableEntry<typeof write.table>[];

                        cache.set(entries);
                    }
                    else {
                        for (const patch of patches) {
                            const entry = cache.get(patch.$ref);

                            if (entry)
                                cache.set(this.#applyPatch(write.table, entry, patch));
                            else
                                complete = false;
                        }
                    }
                }

                cache.complete = complete;
            }
        }

        return results as RecordWriteResults<Writes>;
    }

    #missingCacheRecord(ref: RecordRef, table: string) {
        return `Record "${ref}" does not exist in complete cache for table "${table}"`;
    }

    #applyPatch<Table extends Tables[number]>(
        table: Table,
        entry: RecordTableEntry<Table>,
        patch: RecordTablePatch<Table>
    ): RecordTableEntry<Table> {
        const current = entry as Record<string, any>;
        const changes = patch as Record<string, any>;
        const result = { ...current };

        for (const element of table.schema) {
            const value = changes[element.name];

            if (value === undefined)
                continue;

            if (RecordElement.isGroup(element) && value !== null) {
                const group = current[element.name];
                const updated = group && typeof group === 'object'
                    ? { ...group }
                    : {};

                for (const field of element.fields) {
                    const fieldValue = value[field.name];

                    if (fieldValue !== undefined)
                        updated[field.name] = fieldValue;
                }

                result[element.name] = updated;
            }
            else {
                result[element.name] = value;
            }
        }

        return result as RecordTableEntry<Table>;
    }


    /* Builder factories */
    reader(): RecordReadBuilder<Tables, []> {
        return new RecordReadBuilder<Tables, []>(this, []);
    }

    writer(): RecordWriteBuilder<Tables, []> {
        return new RecordWriteBuilder<Tables, []>(this, []);
    }


    /* Fluent reads */
    getOne<Table extends Tables[number]>(table: Table, ref: RecordRef) {
        return this.reader().getOne(table, ref);
    }

    getMany<Table extends Tables[number]>(table: Table, refs: readonly RecordRef[]) {
        return this.reader().getMany(table, refs);
    }

    getAll<Table extends Tables[number]>(table: Table) {
        return this.reader().getAll(table);
    }


    /* Fluent writes */
    addOne<Table extends Tables[number], Returns extends RecordReturn = undefined>
        (table: Table, data: RecordTableData<Table>, returns?: Returns)
        : RecordWritableExecutable<Tables, readonly [RecordAddResult<Table, RecordTableData<Table>, Returns>]> {
        return this.writer().addOne(table, data, returns);
    }
    addMany<Table extends Tables[number], Returns extends RecordReturn = undefined>
        (table: Table, data: readonly RecordTableData<Table>[], returns?: Returns)
        : RecordWritableExecutable<Tables, readonly [RecordAddResult<Table, readonly RecordTableData<Table>[], Returns>]> {
        return this.writer().addMany(table, data, returns);
    }
    updateOne<Table extends Tables[number], Returns extends RecordReturn = undefined>
        (table: Table, patch: RecordTablePatch<Table>, returns?: Returns)
        : RecordWritableExecutable<Tables, readonly [RecordUpdateResult<Table, RecordTablePatch<Table>, Returns>]> {
        return this.writer().updateOne(table, patch, returns);
    }
    updateMany<Table extends Tables[number], Returns extends RecordReturn = undefined>
        (table: Table, patches: readonly RecordTablePatch<Table>[], returns?: Returns)
        : RecordWritableExecutable<Tables, readonly [RecordUpdateResult<Table, readonly RecordTablePatch<Table>[], Returns>]> {
        return this.writer().updateMany(table, patches, returns);
    }
}