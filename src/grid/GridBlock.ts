import { RecordValue } from "../record";
import { GridCoordinate } from "./GridAddress";

export type GridBlock<T> = { grid: string; start: GridCoordinate | undefined, rows: T[][]; };

export type GridReadBlock = GridBlock<string>;

export type GridWriteBlock = GridBlock<RecordValue>;

function GridColumnBlock<T>(grid: string, values: T[]): GridBlock<T>;
function GridColumnBlock<T>(grid: string, start: GridCoordinate | undefined, values: T[]): GridBlock<T>;
function GridColumnBlock<T>(grid: string, startOrValues: GridCoordinate | T[] | undefined, values?: T[]): GridBlock<T> {
    if (Array.isArray(startOrValues)) {
        values = startOrValues;
        startOrValues = undefined;
    }
    return { grid, start: startOrValues as GridCoordinate | undefined, rows: values!.map(value => [value]) };
}

function GridRowBlock<T>(grid: string, values: T[]): GridBlock<T>;
function GridRowBlock<T>(grid: string, start: GridCoordinate | undefined, values: T[]): GridBlock<T>;
function GridRowBlock<T>(grid: string, startOrValues: GridCoordinate | T[] | undefined, values?: T[]): GridBlock<T> {
    if (Array.isArray(startOrValues)) {
        values = startOrValues;
        startOrValues = undefined;
    }
    return { grid, start: startOrValues as GridCoordinate | undefined, rows: [values!] };
}

function GridRangeBlock<T>(grid: string, values: T[][]): GridBlock<T>;
function GridRangeBlock<T>(grid: string, start: GridCoordinate | undefined, values: T[][]): GridBlock<T>;
function GridRangeBlock<T>(grid: string, startOrValues: GridCoordinate | T[][] | undefined, values?: T[][]): GridBlock<T> {
    if (Array.isArray(startOrValues)) {
        values = startOrValues;
        startOrValues = undefined;
    }
    return { grid, start: startOrValues as GridCoordinate | undefined, rows: values! };
}

function GridCellBlock<T>(grid: string, start: GridCoordinate, value: T): GridBlock<T> {
    return { grid, start, rows: [[value]] };
}


const splitGridBlock = <T>(raw: GridBlock<T>): GridBlock<T>[] => {
    if (!raw.start) return [raw];

    type Segment = { length: number; undefined: boolean; };
    type Row = Segment[];
    type Block = { rows: Row[]; split: boolean; };

    const rows: Row[] = raw.rows.map(row => row.reduce((state, value) => {
        const current = state[state.length - 1];

        const isUndefined = value === undefined;

        if (!current)
            state = [{ length: 1, undefined: isUndefined }];
        else if (current.undefined === isUndefined)
            current.length++;
        else
            state.push({ length: 1, undefined: isUndefined });

        return state;

    }, [] as Segment[]));

    const blocks = rows.reduce((state, row) => {
        // trim trailing undefined values
        if (row.length >= 1 && row[row.length - 1].undefined)
            row.pop();

        const split = row.length !== 1;

        const current = state[state.length - 1];

        if (!current)
            state = [{ rows: [row], split }];
        else if (current.split || split)
            state.push({ rows: [row], split });
        else
            current.rows.push(row);

        return state;
    }, [] as Block[]);

    let rowIndex = 0;

    return blocks.flatMap(block => {
        if (!block.split) {
            const result = {
                grid: raw.grid,
                start: { col: raw.start!.col, row: raw.start!.row + rowIndex },
                rows: block.rows.map((row, index) => raw.rows[rowIndex + index].slice(0, row[0].length)),
            };

            rowIndex += block.rows.length;

            return result;
        }
        else {
            let col = 0;

            const results: GridBlock<T>[] = [];

            for (const segment of block.rows[0]) {
                if (!segment.undefined) {
                    results.push({
                        grid: raw.grid,
                        start: { col: raw.start!.col + col, row: raw.start!.row + rowIndex },
                        rows: [raw.rows[rowIndex].slice(col, col + segment.length)],
                    });
                }

                col += segment.length;
            }

            rowIndex++;

            return results;
        }
    });
};

export const GridBlock = {
    column: GridColumnBlock,
    row: GridRowBlock,
    range: GridRangeBlock,
    cell: GridCellBlock,
    split: splitGridBlock,
};

