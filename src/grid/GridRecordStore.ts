import { RecordTable, RecordTableData, RecordTableEntry, RecordTablePatch } from "../RecordTable";
import { RecordElement, RecordSchema } from "../RecordSchema";
import { RecordStore } from "../RecordStore";
import { GridProvider, GridWriteRequest } from "./GridProvider";
import { freeze, isArray, toArray, toLength } from "../util";
import { RecordRef } from "../RecordShapes";
import { GridAddress, GridCoordinate, GridRange } from "./GridAddress";
import { RecordReadOperation, RecordReadResults, RecordReturn, RecordWriteOperation, RecordWriteResults } from "../RecordOperations";
import { Result } from "../util/Result";
import { GridBlock, GridReadBlock, GridWriteBlock, GridValue } from "./GridBlock";

export type GridTableOptions = {
    name: string;
    offset: number;
};

export type GridTableSource<Table extends RecordTable<any, RecordSchema>> =
    | Table
    | readonly [Table, Partial<GridTableOptions>];

type GridTableSources<Tables extends readonly RecordTable<any, RecordSchema>[]> = {
    [Index in keyof Tables]: GridTableSource<Tables[Index]>;
};


type Span = { from: number; length: number; };

const coalesce = (refs: readonly RecordRef[]): Span[] => {
    const numbers = [...new Set(refs.map(Number))].sort((a, b) => a - b);

    if (numbers.length === 0)
        return [];

    const spans: Span[] = [];
    let current = { from: numbers[0], length: 1 };

    spans.push(current);

    for (let i = 1; i < numbers.length; i++) {
        if (numbers[i] === current.from + current.length)
            current.length++;
        else {
            current = { from: numbers[i], length: 1 };
            spans.push(current);
        }
    }

    return spans;
};



export class GridRecordStore<const Tables extends readonly RecordTable<any, RecordSchema>[]> implements RecordStore<Tables> {

    readonly tables: Tables;

    readonly #provider: GridProvider;

    readonly #options = new Map<RecordTable, GridTableOptions>();


    constructor(provider: GridProvider, sources: GridTableSources<Tables>) {
        this.#provider = provider;

        const tables: RecordTable[] = [];

        for (const source of sources) {
            const table = source instanceof RecordTable ? source : source[0];
            const options = source instanceof RecordTable ? undefined : source[1];

            tables.push(table);

            this.#options.set(table, freeze({
                name: options?.name ?? table.name,
                offset: options?.offset ?? 0
            }));
        }

        this.tables = freeze(tables) as unknown as Tables;
    }


    // Read
    #locate(table: RecordTable, refs?: readonly RecordRef[]): GridRange[] {
        const { name, offset } = this.#options.get(table)!;

        // Get width of the entire row (maybe refactor this?)
        const width = table.schema.reduce((count, element) => count + (RecordElement.isGroup(element) ? element.fields.length : 1), 0);

        if (refs === undefined)
            return [GridAddress.range(name, 0, offset, width)];
        else
            return coalesce(refs).map(span => GridAddress.range(name, 0, offset + span.from, width, span.length));
    }

    #parseRow<Table extends Tables[number]>(table: Table, row: readonly string[], ref: number): RecordTableEntry<Table> {
        const entry: Record<string, any> = { $ref: ref };

        let index = 0;

        for (const element of table.schema) {
            // Groups
            if (RecordElement.isGroup(element)) {
                const values = element.fields.map(() => row[index++]);
                const group: Record<string, any> = {};

                // Skip entirely absent optional groups
                if (element.isOptional && values.every((value, i) =>
                    value === undefined ||
                    (element.fields[i].isOptional && value === '')
                ))
                    continue;

                for (let i = 0; i < element.fields.length; i++) {
                    const field = element.fields[i];
                    const value = values[i];

                    if (value === undefined || (field.isOptional && value === '')) {
                        if (!field.isOptional)
                            throw new Error(`Missing required field '${element.name}.${field.name}'`);

                        continue;
                    }

                    group[field.name] = Result.ensure(field.parse(value), `Failed to parse '${element.name}.${field.name}'`);
                }

                entry[element.name] = group;
            }

            // Fields
            else {
                const value = row[index++];

                if (value === undefined || (element.isOptional && value === '')) {
                    if (!element.isOptional)
                        throw new Error(`Missing required field '${element.name}'`);

                    continue;
                }

                entry[element.name] = Result.ensure(element.parse(value), `Failed to parse '${element.name}'`);
            }
        }

        return entry as RecordTableEntry<Table>;
    }

    async read<const Reads extends readonly RecordReadOperation<Tables[number]>[]>
        (reads: Reads)
        : Promise<RecordReadResults<Reads>> {

        // Locate the ranges required by each read
        const rangesByRead = reads.map(read => {
            if (read.items === 'all')
                return this.#locate(read.table);
            else if ('ref' in read.items)
                return this.#locate(read.table, [read.items.ref]);
            else
                return this.#locate(read.table, read.items.refs);
        });

        // Read all ranges in one batch
        const ranges = rangesByRead.flat();

        const blocks = ranges.length
            ? await this.#provider.read(ranges)
            : [];

        const results: unknown[] = [];

        let blockIndex = 0;

        for (let i = 0; i < reads.length; i++) {
            const read = reads[i];
            const { offset } = this.#options.get(read.table)!;

            const entries = new Map<number, RecordTableEntry<typeof read.table>>();

            // Parse the blocks belonging to this read
            for (let j = 0; j < rangesByRead[i].length; j++) {
                const block = blocks[blockIndex++];

                for (let rowIndex = 0; rowIndex < block.rows.length; rowIndex++) {
                    const ref = block.start!.row + rowIndex - offset;
                    const entry = this.#parseRow(read.table, block.rows[rowIndex], ref);

                    entries.set(ref, entry);
                }
            }

            // Retrieve a parsed record by reference
            const get = (ref: RecordRef) => {
                const entry = entries.get(Number(ref));

                if (entry === undefined)
                    throw new Error(`Record "${ref}" not found in table "${read.table.name}"`);

                return entry;
            };

            // Restore the requested result shape and ordering
            if (read.items === 'all')
                results.push([...entries.values()]);
            else if ('ref' in read.items)
                results.push(get(read.items.ref));
            else
                results.push(read.items.refs.map(get));
        }

        return results as RecordReadResults<Reads>;
    }


    // Write
    #encodeRow<Table extends Tables[number]>(table: Table, data: RecordTableData<Table> | RecordTablePatch<Table>): GridValue[] {
        const values: GridValue[] = [];
        const record = data as Record<string, any>;

        for (const element of table.schema) {
            if (RecordElement.isGroup(element)) {
                const group = record[element.name];

                for (const field of element.fields) {
                    const value = group === null ? null : group?.[field.name];
                    values.push(value === undefined ? undefined : field.encode(value));
                }
            }
            else {
                const value = record[element.name];
                values.push(value === undefined ? undefined : element.encode(value));
            }
        }

        return values;
    }

    #addBlock<Table extends Tables[number]>(
        table: Table,
        data: RecordTableData<Table> | readonly RecordTableData<Table>[]
    ): GridWriteBlock {
        const { name } = this.#options.get(table)!;
        const records = toArray(data);

        return GridBlock.range(name, records.map(record => this.#encodeRow(table, record)));
    }

    #updateBlock<Table extends Tables[number]>(
        table: Table,
        patch: RecordTablePatch<Table>
    ): GridWriteBlock {
        const { name, offset } = this.#options.get(table)!;

        return GridBlock.row(
            name,
            { col: 0, row: offset + Number(patch.$ref) },
            this.#encodeRow(table, patch)
        );
    }

    async write<const Writes extends readonly RecordWriteOperation<Tables[number]>[]>
        (writes: Writes): Promise<RecordWriteResults<Writes>> {

        // 1. Convert write operations into grid requests        
        const requestsByWrite: GridWriteRequest[][] = writes.map(write => {
            if (write.type === 'add') {
                return [{
                    block: this.#addBlock(write.table, write.data),
                    returns: write.returns
                }];
            }
            else {
                const patches = toArray(write.patches);

                return patches.map(patch => ({
                    block: this.#updateBlock(write.table, patch),
                    returns: write.returns === RecordReturn.Ref
                        ? undefined
                        : write.returns
                }));
            }
        });

        const requests = requestsByWrite.flat();


        // 2. Execute all requests through GridProvider        
        const gridResults = requests.length
            ? await this.#provider.write(requests)
            : [];

        // 3. Convert grid results into record results
        const results: unknown[] = [];
        let resultIndex = 0;

        for (let i = 0; i < writes.length; i++) {
            const write = writes[i];

            const writeResults = gridResults.slice(
                resultIndex,
                resultIndex + requestsByWrite[i].length
            );

            resultIndex += requestsByWrite[i].length;

            // Add
            if (write.type === 'add') {
                const result = writeResults[0];
                const { offset } = this.#options.get(write.table)!;
                const length = toLength(write.data);
                const many = isArray(write.data);

                if (write.returns === RecordReturn.Data) {
                    const block = result as GridReadBlock;

                    const entries = block.rows.map((row, index) =>
                        this.#parseRow(write.table, row, block.start!.row + index - offset)
                    );

                    results.push(many ? entries : entries[0]);
                }
                else if (write.returns === RecordReturn.Ref) {
                    const start = result as GridCoordinate;

                    const refs = Array.from(
                        { length },
                        (_, index) => start.row + index - offset
                    );

                    results.push(many ? refs : refs[0]);
                }
                else
                    results.push(undefined);
            }

            // Update
            else {
                const patches = toArray(write.patches);
                const many = isArray(write.patches);

                if (write.returns === RecordReturn.Data) {
                    const { offset } = this.#options.get(write.table)!;

                    const entries = (writeResults as GridReadBlock[]).map(block =>
                        this.#parseRow(write.table, block.rows[0], block.start!.row - offset)
                    );

                    results.push(many ? entries : entries[0]);
                }
                else if (write.returns === RecordReturn.Ref) {
                    const refs = patches.map(patch => patch.$ref);

                    results.push(many ? refs : refs[0]);
                }
                else
                    results.push(undefined);
            }
        }

        return results as RecordWriteResults<Writes>;
    }

    invalidate(): void {
        this.#provider.invalidate();
    }
}

