import { RecordReadOperation, RecordReadResults, RecordWriteOperation, RecordWriteResults } from "../RecordOperations";
import { RecordSchema } from "../RecordSchema";
import { RecordStore } from "../RecordStore";
import { RecordTable } from "../RecordTable";
import { GridProvider } from "./GridProvider";


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
    async read<const Reads extends readonly RecordReadOperation<Tables[number]>[]>(reads: Reads): Promise<RecordReadResults<Reads>> {
        throw new Error('Not implemented');
    }

    /* Write */
    async write<const Writes extends readonly RecordWriteOperation<Tables[number]>[]>(writes: Writes): Promise<RecordWriteResults<Writes>> {
        throw new Error('Not implemented');
    }

    /* Invalidate */
    invalidate(): void {
        this.#provider.invalidate();
    }
}

