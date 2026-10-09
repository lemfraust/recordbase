import { RecordTable } from "../RecordTable";
import { RecordSchema } from "../RecordSchema";
import { RecordStore } from "../RecordStore";
import { GridProvider } from "./GridProvider";
import { freeze } from "../util";

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


export class GridRecordStore<
    const Tables extends readonly RecordTable<any, RecordSchema>[]
> {
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
}

