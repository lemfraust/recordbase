import { RecordIssue } from "../RecordIssue";
import { RecordReadOperation, RecordReadResults, RecordWriteOperation, RecordWriteResults } from "../RecordOperations";
import { RecordElement, RecordSchema, RecordValue } from "../RecordSchema";
import { RecordId } from "../RecordShapes";
import { RecordStore } from "../RecordStore";
import { RecordTable, RecordTableData, RecordTableEntry, RecordTablePatch } from "../RecordTable";
import { ResultError } from "../Result";
import { isArray } from "../util";
import { GridAddress, GridRange } from "./GridAddress";
import { GridFetchBlock, GridSetBlock } from "./GridBlock";
import { GridProvider } from "./GridProvider";

type GridSpan = {
    from: number;
    length: number;
};

const coalesce = (rows: readonly number[]): GridSpan[] => {
    const unique = [...new Set(rows)].sort((a, b) => a - b);

    if (!unique.length)
        return [];

    const spans: GridSpan[] = [];

    let current = spans[0] = { from: unique[0], length: 1 };

    for (let i = 1; i < unique.length; i++) {
        if (unique[i] === current.from + current.length)
            current.length++;
        else
            current = spans[spans.length] = { from: unique[i], length: 1 };
    }

    return spans;
};

export type GridTableOptions = {
    name: string;
    offset: number;
};

type GridTableSource<Table extends RecordTable<any, RecordSchema>> =
    | Table
    | readonly [Table, Partial<GridTableOptions>];

type GridTableSources<Tables extends readonly RecordTable<any, RecordSchema>[]> = {
    [Index in keyof Tables]: GridTableSource<Tables[Index]>;
};


export class GridRecordStore<
    const Tables extends readonly RecordTable<any, RecordSchema>[]
> implements RecordStore<Tables> {
    readonly #provider: GridProvider;
    readonly #options: readonly GridTableOptions[];

    readonly tables: Tables;

    constructor(provider: GridProvider, ...sources: GridTableSources<Tables>) {
        this.#provider = provider;

        this.tables = sources.map(source =>
            Array.isArray(source) ? source[0] : source
        ) as unknown as Tables;

        this.#options = sources.map(source => {
            const table = Array.isArray(source) ? source[0] : source;
            const options = Array.isArray(source) ? source[1] : {};

            return {
                name: options.name ?? table.name,
                offset: options.offset ?? 0
            };
        });
    }

    /* Read */
    #getOptions(table: Tables[number]): GridTableOptions {
        const index = this.tables.indexOf(table);

        if (index === -1)
            throw new Error(`Table "${table.name}" does not belong to this store`);

        return this.#options[index];
    }

    #width(table: RecordTable): number {
        return table.schema.reduce(
            (width, element) => width + (RecordElement.isGroup(element) ? element.fields.length : 1),
            0
        );
    }

    #row(id: RecordId): number {
        if (typeof id !== 'number' || !Number.isInteger(id) || id < 0)
            throw new Error(`Grid record ID must be a non-negative integer`);

        return id;
    }

    #locate(read: RecordReadOperation<Tables[number]>): GridRange[] {
        const options = this.#getOptions(read.table);
        const width = this.#width(read.table);

        if (read.items === 'all')
            return [GridAddress.range(options.name, 0, options.offset, width)];

        const rows = 'id' in read.items
            ? [this.#row(read.items.id)]
            : read.items.ids.map(id => this.#row(id));

        return coalesce(rows).map(span =>
            GridAddress.range(
                options.name,
                0,
                options.offset + span.from,
                width,
                span.length
            )
        );
    }

    #parse<Table extends Tables[number]>
        (table: Table, options: GridTableOptions, blocks: readonly GridFetchBlock[])
        : RecordTableEntry<Table>[] {

        const results: RecordTableEntry<Table>[] = [];
        const issues: RecordIssue[] = [];

        for (const block of blocks) {
            if (block.grid !== options.name)
                throw new Error(`Expected grid "${options.name}" but received "${block.grid}"`);
            if (!block.start)
                throw new Error(`Missing grid block start`);
            if (block.start.col !== 0)
                throw new Error(`Expected grid block column 0 but received ${block.start.col}`);

            for (let b = 0; b < block.rows.length; b++) {
                const row = block.rows[b];

                const result: any = {
                    $id: (block.start.row + b) - options.offset
                };

                let index = 0;

                for (const element of table.schema) {
                    if (RecordElement.isGroup(element)) {
                        let group: any = element.isOptional ? undefined : {};
                        const missing: RecordIssue[] = [];
                        let started = false;

                        for (const field of element.fields) {
                            const name = `${element.name}.${field.name}`;
                            let value: string | undefined = row[index++];

                            if (field.isOptional && value === '')
                                value = undefined;
                            else if (value !== undefined) {
                                started = true;

                                const parsed = field.parse(value);

                                if (parsed.success)
                                    (group ??= {})[field.name] = parsed.value;
                                else
                                    issues.push(RecordIssue.parsingFailed(name, parsed.info));
                            }
                            else if (!field.isOptional) {
                                missing.push(RecordIssue.missingField(name));
                            }
                        }

                        if (started || !element.isOptional) {
                            issues.push(...missing);

                            if (group)
                                result[element.name] = group;
                        }
                    }
                    else {
                        let value: string | undefined = row[index++];

                        if (element.isOptional && value === '')
                            value = undefined;
                        else if (value !== undefined) {
                            const parsed = element.parse(value);

                            if (parsed.success)
                                result[element.name] = parsed.value;
                            else
                                issues.push(RecordIssue.parsingFailed(element.name, parsed.info));
                        }
                        else if (!element.isOptional) {
                            issues.push(RecordIssue.missingField(element.name));
                        }
                    }
                }

                results.push(result);
            }
        }

        if (issues.length)
            throw new ResultError(`Failed to parse table "${table.name}"`, issues);

        return results;
    }

    async read<const Reads extends readonly RecordReadOperation<Tables[number]>[]>(reads: Reads): Promise<RecordReadResults<Reads>> {
        const ranges: GridRange[] = [];
        const lengths: number[] = [];

        for (const read of reads) {
            const located = this.#locate(read);

            lengths.push(located.length);
            ranges.push(...located);
        }

        const blocks = ranges.length
            ? await this.#provider.fetch(ranges)
            : [];

        if (blocks.length !== ranges.length)
            throw new Error(`Grid provider returned ${blocks.length} blocks for ${ranges.length} ranges`);

        const results: unknown[] = [];
        let blockIndex = 0;

        for (let i = 0; i < reads.length; i++) {
            const read = reads[i];
            const options = this.#getOptions(read.table);

            const readBlocks = blocks.slice(
                blockIndex,
                blockIndex += lengths[i]
            );

            const records = this.#parse(read.table, options, readBlocks);

            if (read.items === 'all') {
                results.push(records);
            }
            else if ('id' in read.items) {
                const id = this.#row(read.items.id);
                const record = records.find(record => record.$id === id);

                if (!record)
                    throw new Error(`Record "${read.items.id}" does not exist in table "${read.table.name}"`);

                results.push(record);
            }
            else {
                const recordsById = new Map<number, (typeof records)[number]>(
                    records.map(record => [this.#row(record.$id), record])
                );

                results.push(read.items.ids.map(id => {
                    const row = this.#row(id);
                    const record = recordsById.get(row);

                    if (!record)
                        throw new Error(`Record "${id}" does not exist in table "${read.table.name}"`);

                    return record;
                }));
            }
        }

        return results as RecordReadResults<Reads>;
    }

    /* Write */
    #encodeData<Table extends Tables[number]>(table: Table, data: RecordTableData<Table>): RecordValue[] {
        const record = data as any;
        const values: RecordValue[] = [];

        for (const element of table.schema) {
            if (RecordElement.isGroup(element)) {
                const group = record[element.name];

                for (const field of element.fields)
                    values.push(field.encode(group?.[field.name]));
            }
            else {
                values.push(element.encode(record[element.name]));
            }
        }

        return values;
    }
    #encodePatch<Table extends Tables[number]>(table: Table, patch: RecordTablePatch<Table>): RecordValue[] {
        const record = patch as any;
        const values: RecordValue[] = [];

        for (const element of table.schema) {
            if (RecordElement.isGroup(element)) {
                const group = record[element.name];

                if (group === undefined) {
                    for (const field of element.fields)
                        values.push(undefined);
                }
                else if (group === null) {
                    for (const field of element.fields)
                        values.push(field.encode(null));
                }
                else {
                    for (const field of element.fields) {
                        const value = group[field.name];

                        values.push(
                            value === undefined
                                ? undefined
                                : field.encode(value)
                        );
                    }
                }
            }
            else {
                const value = record[element.name];

                values.push(
                    value === undefined
                        ? undefined
                        : element.encode(value)
                );
            }
        }

        return values;
    }
    async write<const Writes extends readonly RecordWriteOperation<Tables[number]>[]>(writes: Writes): Promise<RecordWriteResults<Writes>> {
        const blocks: GridSetBlock[] = [];
        const addBlocks: (number | undefined)[] = [];

        for (const write of writes) {
            const options = this.#getOptions(write.table);

            if (write.type === 'add') {
                const data = isArray(write.data)
                    ? write.data
                    : [write.data];

                if (data.length) {
                    addBlocks.push(blocks.length);

                    blocks.push({
                        grid: options.name,
                        start: undefined,
                        rows: data.map(data => this.#encodeData(write.table, data))
                    });
                }
                else {
                    addBlocks.push(undefined);
                }
            }
            else {
                addBlocks.push(undefined);

                const patches = isArray(write.patches)
                    ? write.patches
                    : [write.patches];

                for (const patch of patches) {
                    blocks.push({
                        grid: options.name,
                        start: {
                            col: 0,
                            row: options.offset + this.#row(patch.$id)
                        },
                        rows: [this.#encodePatch(write.table, patch)]
                    });
                }
            }
        }

        const starts = blocks.length
            ? await this.#provider.set(blocks)
            : [];

        if (starts.length !== blocks.length)
            throw new Error(`Grid provider returned ${starts.length} results for ${blocks.length} blocks`);

        const entryReads: RecordReadOperation<Tables[number]>[] = [];
        const entryIndexes: (number | undefined)[] = [];

        for (const write of writes) {
            if (write.type === 'update' && write.returns === 'entry') {
                const patches = isArray(write.patches)
                    ? write.patches
                    : [write.patches];

                const ids = patches.map(patch => this.#row(patch.$id));

                if (!ids.length) {
                    entryIndexes.push(undefined);
                }
                else {
                    entryIndexes.push(entryReads.length);

                    entryReads.push({
                        type: 'read',
                        table: write.table,
                        items: isArray(write.patches)
                            ? { ids }
                            : { id: ids[0] }
                    });
                }
            }
            else {
                entryIndexes.push(undefined);
            }
        }

        const entryResults = entryReads.length
            ? await this.read(entryReads) as unknown[]
            : [];

        const results: unknown[] = [];

        for (let i = 0; i < writes.length; i++) {
            const write = writes[i];

            if (write.type === 'add') {
                const options = this.#getOptions(write.table);
                const data = isArray(write.data)
                    ? write.data
                    : [write.data];

                if (!data.length) {
                    results.push([]);
                    continue;
                }

                const blockIndex = addBlocks[i]!;
                const start = starts[blockIndex];

                const entries = data.map((data, index) => ({
                    ...data,
                    $id: start.row + index - options.offset
                }));

                results.push(
                    isArray(write.data)
                        ? entries
                        : entries[0]
                );
            }
            else if (write.returns === 'entry') {
                const entryIndex = entryIndexes[i];

                results.push(
                    entryIndex === undefined
                        ? []
                        : entryResults[entryIndex]
                );
            }
            else {
                const patches = isArray(write.patches)
                    ? write.patches
                    : [write.patches];

                const ids = patches.map(patch =>
                    this.#row(patch.$id)
                );

                results.push(
                    isArray(write.patches)
                        ? ids
                        : ids[0]
                );
            }
        }

        return results as RecordWriteResults<Writes>;
    }

    /* Invalidate */
    invalidate(): void {
        this.#provider.invalidate();
    }
}

