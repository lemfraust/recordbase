export type GridCoordinate = { col: number; row: number; };

export type GridOrigin = { grid: string, from: GridCoordinate; };

export type GridRange = GridOrigin & { to?: Partial<GridCoordinate>; };

const charCodeA = 'A'.charCodeAt(0);

const letterfy = (value: number): string => {
    let result = '';

    while (value >= 0) {
        const digit = String.fromCharCode(charCodeA + value % 26 | 0);
        result = digit + result;
        value = (value / 26 | 0) - 1;
    }

    return result;
};

const unletterfy = (value: string): number => {
    let result = 0;

    for (let i = 0; i < value.length; i++)
        result = (result * 26) + (value.toUpperCase().charCodeAt(i) - charCodeA + 1);

    return result - 1;
};

// Grid!A1 | Grid!A1:B | Grid!A1:1 | Grid!A1:B1
const A1Regex = /^(?<grid>.+)!(?<fromCol>[A-Za-z]+)(?<fromRow>\d+)(?::(?:(?<toCol1>[A-Za-z]+)(?<toRow1>\d+)?|(?<toCol2>[A-Za-z]+)?(?<toRow2>\d+)))?$/;

export const GridAddress = {
    cell: (grid: string, col: number, row: number): GridOrigin => ({ grid, from: { col, row } }),

    column: (grid: string, col: number, offset: number, height?: number): GridRange =>
        ({ grid, from: { col, row: offset }, to: { col, row: height ? offset + height - 1 : undefined } }),

    row: (grid: string, row: number, offset: number, width?: number): GridRange =>
        ({ grid, from: { col: offset, row }, to: { col: width ? offset + width - 1 : undefined, row } }),

    range: (grid: string, col: number, row: number, width?: number, height?: number): GridRange =>
        ({ grid, from: { col, row }, to: { col: width ? col + width - 1 : undefined, row: height ? row + height - 1 : undefined } }),

    toA1: (range: GridRange, encoder?: (name: string) => string): string => {
        const { from, to } = range;

        let result = letterfy(from.col) + (from.row + 1);

        if (to) {
            const { col, row } = to;

            const toResult = `${col !== undefined ? letterfy(col) : ''}${row !== undefined ? row + 1 : ''}`;

            if (toResult && toResult !== result)
                result += ':' + toResult;
        }

        const grid = encoder ? encoder(range.grid) : range.grid;

        return `${grid}!${result}`;
    },
    fromA1: (a1: string, decoder?: (name: string) => string): GridRange => {
        const match = a1.match(A1Regex);

        if (!match) throw new Error('Invalid A1 range');

        let { grid, fromCol, fromRow, toCol1, toRow1, toCol2, toRow2 } = match.groups!;

        if (decoder) grid = decoder(grid);

        const from = { col: unletterfy(fromCol), row: parseInt(fromRow) - 1 };

        const toColumn = (toCol1 || toCol2) ? unletterfy(toCol1 || toCol2) : undefined;
        const toRow = (toRow1 || toRow2) ? parseInt(toRow1 || toRow2) - 1 : undefined;

        const to = (toColumn !== undefined || toRow !== undefined) ? { col: toColumn, row: toRow } : undefined;

        return { grid, from, to };
    }
};
