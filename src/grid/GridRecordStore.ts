import { RecordTable } from "../RecordTable";
import { RecordElement, RecordSchema } from "../RecordSchema";
import { RecordStore } from "../RecordStore";
import { GridProvider } from "./GridProvider";
import { freeze } from "../util";
import { RecordRef } from "../RecordShapes";
import { GridAddress, GridRange } from "./GridAddress";

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


export class GridRecordStore<const Tables extends readonly RecordTable<any, RecordSchema>[]> {
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


    #locate(table: RecordTable, refs?: readonly RecordRef[]): GridRange[] {
        const { name, offset } = this.#options.get(table)!;

        // Get width of the entire row (maybe refactor this?)
        const width = table.schema.reduce((count, element) => count + (RecordElement.isGroup(element) ? element.fields.length : 1), 0);

        if (refs === undefined)
            return [GridAddress.range(name, 0, offset, width)];
        else
            return refs.map(ref => GridAddress.range(name, 0, offset + Number(ref), width, 1));
    }
}

