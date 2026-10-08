import { RecordReadable, RecordReadBuilder, RecordWritable, RecordWritableExecutable, RecordWriteBuilder } from "./RecordOperationBuilders";
import { RecordAddResult, RecordReadOperation, RecordReadResults, RecordUpdateResult, RecordWriteOperation, RecordWriteResults, RecordWriteReturns } from "./RecordOperations";
import { RecordCache, RecordMemoryCache } from "./RecordCache";
import { RecordElement } from "./RecordSchema";
import { RecordEntry, RecordId } from "./RecordShapes";
import { RecordReader, RecordStore, RecordWriter } from "./RecordStore";
import { RecordTable, RecordTableData, RecordTableEntry, RecordTablePatch, RecordTableSchema } from "./RecordTable";
import { isArray } from "./util";

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


    // TODO: Refactor more
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
            else if ('id' in read.items) {
                const id = read.items.id;

                const result = cache?.get(id);

                if (result)
                    results[i] = result;
                else if (cache?.complete)
                    throw new Error(this.#missingCacheRecord(id, read.table.name));
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
                        throw new Error(this.#missingCacheRecord(id, read.table.name));
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

                    if ('id' in read.items)
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

        const storeWrites = writes.map(write => {
            if (
                write.type === 'add' &&
                write.returns === undefined &&
                this.#caches.has(write.table)
            ) {
                return {
                    ...write,
                    returns: 'id' as const
                };
            }

            return write;
        }) as readonly RecordWriteOperation<Tables[number]>[];

        const storeResults = await this.#store.write(storeWrites);
        const results: unknown[] = [];

        for (let index = 0; index < writes.length; index++) {
            const write = writes[index];
            const storeWrite = storeWrites[index];
            const storeResult = storeResults[index];

            const cache = this.#caches.get(write.table) as
                | RecordCache<RecordTableSchema<typeof write.table>>
                | undefined;

            if (cache) {
                const complete = cache.complete;

                if (write.type === 'add' && storeWrite.type === 'add') {
                    const data = isArray(write.data)
                        ? write.data
                        : [write.data];

                    if (storeWrite.returns === 'entry') {
                        if (storeResult === undefined)
                            throw new Error(`Expected entries from add to table "${write.table.name}"`);

                        const entries = (
                            Array.isArray(storeResult)
                                ? storeResult
                                : [storeResult]
                        ) as RecordTableEntry<typeof write.table>[];

                        cache.set(entries);
                    }
                    else if (storeWrite.returns === 'id') {
                        if (storeResult === undefined)
                            throw new Error(`Expected IDs from add to table "${write.table.name}"`);

                        const ids = (
                            Array.isArray(storeResult)
                                ? storeResult
                                : [storeResult]
                        ) as RecordId[];

                        if (ids.length !== data.length)
                            throw new Error(`Expected ${data.length} IDs but received ${ids.length}`);

                        const entries = data.map((data, index) => ({
                            ...data,
                            $id: ids[index]
                        })) as RecordTableEntry<typeof write.table>[];

                        cache.set(entries);
                    }
                }
                else if (write.type === 'update') {
                    const patches = isArray(write.patches)
                        ? write.patches
                        : [write.patches];

                    if (write.returns === 'entry') {
                        if (storeResult === undefined)
                            throw new Error(`Expected entries from update to table "${write.table.name}"`);

                        const entries = (
                            Array.isArray(storeResult)
                                ? storeResult
                                : [storeResult]
                        ) as RecordTableEntry<typeof write.table>[];

                        cache.set(entries);
                    }
                    else {
                        for (const patch of patches) {
                            const entry = cache.get(patch.$id);

                            if (entry)
                                cache.set(this.#applyPatch(write.table, entry, patch));
                            else if (cache.complete)
                                throw new Error(
                                    `Record "${patch.$id}" does not exist in table "${write.table.name}"`
                                );
                        }
                    }
                }

                cache.complete = complete;
            }

            results.push(
                write.returns === undefined
                    ? undefined
                    : storeResult
            );
        }

        return results as RecordWriteResults<Writes>;
    }

    #missingCacheRecord(id: RecordId, table: string) {
        return `Record "${id}" does not exist in complete cache for table "${table}"`;
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
    getOne<Table extends Tables[number]>(table: Table, id: RecordId) {
        return this.reader().getOne(table, id);
    }

    getMany<Table extends Tables[number]>(table: Table, ids: readonly RecordId[]) {
        return this.reader().getMany(table, ids);
    }

    getAll<Table extends Tables[number]>(table: Table) {
        return this.reader().getAll(table);
    }


    /* Fluent writes */
    addOne<Table extends Tables[number], Returns extends RecordWriteReturns = undefined>
        (table: Table, data: RecordTableData<Table>, returns?: Returns)
        : RecordWritableExecutable<Tables, readonly [RecordAddResult<Table, RecordTableData<Table>, Returns>]> {
        return this.writer().addOne(table, data, returns);
    }
    addMany<Table extends Tables[number], Returns extends RecordWriteReturns = undefined>
        (table: Table, data: readonly RecordTableData<Table>[], returns?: Returns)
        : RecordWritableExecutable<Tables, readonly [RecordAddResult<Table, readonly RecordTableData<Table>[], Returns>]> {
        return this.writer().addMany(table, data, returns);
    }
    updateOne<Table extends Tables[number], Returns extends RecordWriteReturns = undefined>
        (table: Table, patch: RecordTablePatch<Table>, returns?: Returns)
        : RecordWritableExecutable<Tables, readonly [RecordUpdateResult<Table, RecordTablePatch<Table>, Returns>]> {
        return this.writer().updateOne(table, patch, returns);
    }
    updateMany<Table extends Tables[number], Returns extends RecordWriteReturns = undefined>
        (table: Table, patches: readonly RecordTablePatch<Table>[], returns?: Returns)
        : RecordWritableExecutable<Tables, readonly [RecordUpdateResult<Table, readonly RecordTablePatch<Table>[], Returns>]> {
        return this.writer().updateMany(table, patches, returns);
    }
}