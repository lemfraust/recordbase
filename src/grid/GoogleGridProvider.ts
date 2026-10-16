import { auth, sheets, sheets_v4 } from "@googleapis/sheets";

import { execute, ExecutorHandler, lazy, Lazy, Resolvable, retryHandler } from "../util";
import { GridAddress, GridCoordinate, GridRange } from "./GridAddress";
import { GridBlock, GridReadBlock, GridWriteBlock, GridValue } from "./GridBlock";
import { GridProvider, GridWriteRequest, GridWriteResults } from "./GridProvider";


/* Google Types */
export type GoogleApi = sheets_v4.Sheets;

type GoogleCellValue = sheets_v4.Schema$ExtendedValue;

type GoogleWriteRequest = sheets_v4.Schema$Request;



/* Google Helpers */
export type GoogleApiCredentials = { email: string, key: string; };

export type GoogleApiSource = Resolvable<GoogleApi> | GoogleApiCredentials;

const isGoogleApiCredentials = (source: GoogleApiSource): source is GoogleApiCredentials =>
    typeof source === 'object' && source !== null &&
    'email' in source && 'key' in source;

const createGoogleApi = async ({ email, key }: GoogleApiCredentials): Promise<GoogleApi> => {
    const client = await auth.getClient({
        credentials: {
            client_email: email,
            private_key: key
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    return sheets({ version: 'v4', auth: client });
};

const encodeGridName = (name: string): string => `'${name.replaceAll("'", "''")}'`;

const dateToSerialNumber = (date: Date): number => {
    const epoch = new Date(1899, 11, 30);
    return (date.getTime() - epoch.getTime()) / 86400000;
};

const toGoogleCellValue = (value: GridValue): GoogleCellValue | undefined => {
    if (typeof value === 'string')
        return { stringValue: value };
    else if (typeof value === 'number')
        return { numberValue: value };
    else if (typeof value === 'boolean')
        return { boolValue: value };
    else if (value instanceof Date)
        return { numberValue: dateToSerialNumber(value) };
    else if (value === null)
        return { stringValue: '' };
    else if (value === undefined)
        return undefined;
    else
        return { formulaValue: value.formula.startsWith('=') ? value.formula : `=${value.formula}` };
};

const toGoogleAppendValue = (value: GridValue): string | number | boolean | null => {
    if (value === undefined)
        return null;

    else if (value === null)
        return '';

    else if (value instanceof Date)
        return dateToSerialNumber(value);

    else if (typeof value === 'string')
        return value ? `'${value}` : '';

    else if (typeof value === 'object')
        return value.formula.startsWith('=')
            ? value.formula
            : `=${value.formula}`;

    else
        return value;
};

const toGoogleWriteRequest = (sheetIds: ReadonlyMap<string, number>, block: GridWriteBlock): GoogleWriteRequest => {
    const sheetId = sheetIds.get(block.grid);

    if (sheetId === undefined)
        throw new Error(`Unknown Google sheet "${block.grid}"`);

    const rows = block.rows.map(row => ({
        values: row.map(value => ({
            userEnteredValue: toGoogleCellValue(value)
        }))
    }));

    const fields = 'userEnteredValue';

    return block.start === undefined
        ? { appendCells: { sheetId, rows, fields } }
        : {
            updateCells: {
                start: {
                    sheetId,
                    rowIndex: block.start.row,
                    columnIndex: block.start.col
                },
                rows,
                fields
            }
        };
};



/* Options */
export type GoogleGridProviderOptions = {
    id: string;
    api: GoogleApiSource;
    handlers?: ExecutorHandler | GoogleGridProviderHandlerOptions;
};

/* Handlers */
export type GoogleGridProviderHandlerOptions = {
    default?: ExecutorHandler;
    read?: ExecutorHandler;
    write?: ExecutorHandler;
    info?: ExecutorHandler;
};

type GoogleGridProviderHandlers = Required<Omit<GoogleGridProviderHandlerOptions, 'default'>>;

const noRetry: ExecutorHandler = () => undefined;

const retry = retryHandler({ attempts: 3, wait: 1000 });

const defaultHandlers: GoogleGridProviderHandlers = {
    read: retry,
    write: noRetry,
    info: retry
};

const resolveHandlers = (handlers: GoogleGridProviderOptions['handlers']): GoogleGridProviderHandlers => {
    if (typeof handlers === 'function')
        return { read: handlers, write: handlers, info: handlers };

    const resolve = (key: keyof GoogleGridProviderHandlers): ExecutorHandler =>
        handlers?.[key] ?? handlers?.default ?? defaultHandlers[key];

    return { read: resolve('read'), write: resolve('write'), info: resolve('info') };
};


/* Writes */
type IndexedWrite = {
    index: number;
    request: GridWriteRequest;
};

type PlannedAppend = {
    block: GridWriteBlock;
    parts: (IndexedWrite & {
        offset: number;
        length: number;
    })[];
};

type PlannedUpdate = IndexedWrite & {
    blocks: GridWriteBlock[];
};

type WritePlan = {
    appends: Map<string, PlannedAppend>;
    updates: PlannedUpdate[];
};

const planWrites = (requests: readonly GridWriteRequest[]): WritePlan => {
    const appends = new Map<string, PlannedAppend>();
    const updates: PlannedUpdate[] = [];

    requests.forEach((request, index) => {
        const { block } = request;

        if (block.start !== undefined) {
            updates.push({
                index,
                request,
                blocks: GridBlock.split(block)
            });
            return;
        }

        let group = appends.get(block.grid);

        if (!group) {
            group = {
                block: { grid: block.grid, start: undefined, rows: [] },
                parts: []
            };

            appends.set(block.grid, group);
        }

        const offset = group.block.rows.length;

        group.block.rows.push(...block.rows);

        group.parts.push({
            index,
            request,
            offset,
            length: block.rows.length
        });
    });

    return { appends, updates };
};



/* MAIN CLASS */
export class GoogleGridProvider implements GridProvider {
    readonly #id: string;
    readonly #api: Lazy<GoogleApi>;
    readonly #handlers: GoogleGridProviderHandlers;

    #sheetIds?: Lazy<Map<string, number>>;


    constructor(options: GoogleGridProviderOptions) {
        this.#id = options.id;

        const source = options.api;

        this.#api = lazy(
            isGoogleApiCredentials(source)
                ? () => createGoogleApi(source)
                : source
        );

        this.#handlers = resolveHandlers(options.handlers);
    }

    async read(ranges: readonly GridRange[]): Promise<GridReadBlock[]> {
        if (!ranges.length) return [];

        // translate ranges into A1 notation
        const a1Ranges = ranges.map(range => GridAddress.toA1(range, encodeGridName));

        // execute batchGet
        const api = await this.#api;

        const response = await execute(() => api.spreadsheets.values.batchGet({
            spreadsheetId: this.#id,
            ranges: a1Ranges,
            majorDimension: "ROWS",
            valueRenderOption: "FORMATTED_VALUE"
        }), this.#handlers.read);

        // translate results into GridReadBlocks
        const values = response.data.valueRanges ?? [];

        return ranges.map((range, index) => ({
            grid: range.grid,
            start: range.from,
            rows: (values[index]?.values ?? []) as string[][]
        }));
    }

    // Write
    async #loadSheetIds(): Promise<Map<string, number>> {
        const cache = this.#sheetIds ??= lazy(async () => {
            const api = await this.#api;

            const response = await execute(() => api.spreadsheets.get({
                spreadsheetId: this.#id,
                fields: "sheets(properties(sheetId,title))"
            }), this.#handlers.info);

            const ids = new Map<string, number>();

            for (const sheet of response.data.sheets ?? []) {
                const properties = sheet.properties;

                if (properties?.title != null && properties.sheetId != null)
                    ids.set(properties.title, properties.sheetId);
            }

            return ids;
        });

        return await cache;
    }

    async #writeBatch(blocks: readonly GridWriteBlock[]): Promise<void> {
        if (!blocks.length)
            return;

        const api = await this.#api;
        const sheetIds = await this.#loadSheetIds();

        const requests = blocks.map(block =>
            toGoogleWriteRequest(sheetIds, block)
        );

        await execute(() => api.spreadsheets.batchUpdate({
            spreadsheetId: this.#id,
            requestBody: { requests }
        }), this.#handlers.write);
    }

    async #appendGroup(group: PlannedAppend): Promise<GridCoordinate> {
        const api = await this.#api;
        const { block } = group;

        const response = await execute(() => api.spreadsheets.values.append({
            spreadsheetId: this.#id,
            range: encodeGridName(block.grid),
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                majorDimension: 'ROWS',
                values: block.rows.map(row => row.map(toGoogleAppendValue))
            }
        }), this.#handlers.write);

        const range = response.data.updates?.updatedRange;

        if (!range)
            throw new Error(`Google Sheets did not return an append range for "${block.grid}"`);

        return GridAddress.fromA1(range).from;
    }

    async #executePlan(plan: WritePlan): Promise<Map<number, GridCoordinate>> {
        const locations = new Map<number, GridCoordinate>();

        const blocks = plan.updates.flatMap(update => update.blocks);
        const positioned: PlannedAppend[] = [];

        // Updates already have known coordinates
        for (const update of plan.updates) {
            if (update.request.returns !== undefined)
                locations.set(update.index, update.request.block.start!);
        }

        // Separate append groups by whether coordinates are needed
        for (const group of plan.appends.values()) {
            if (group.parts.some(part => part.request.returns !== undefined))
                positioned.push(group);
            else
                blocks.push(group.block);
        }

        // One batched write for updates and ordinary appends
        await this.#writeBatch(blocks);

        // Append groups requiring their actual positions
        for (const group of positioned) {
            const start = await this.#appendGroup(group);

            for (const part of group.parts) {
                if (part.request.returns !== undefined)
                    locations.set(part.index, {
                        col: start.col,
                        row: start.row + part.offset
                    });
            }
        }

        return locations;
    }

    async #resolveResults(
        requests: readonly GridWriteRequest[],
        locations: ReadonlyMap<number, GridCoordinate>
    ): Promise<unknown[]> {
        const results: unknown[] = new Array(requests.length).fill(undefined);

        const ranges: GridRange[] = [];
        const indices: number[] = [];

        // 1. Resolve refs and collect requested data ranges
        requests.forEach((request, index) => {
            if (request.returns === undefined)
                return;

            const start = locations.get(index)!;

            if (request.returns === 'ref') {
                results[index] = start;
                return;
            }

            const { block } = request;
            const width = block.rows.reduce(
                (max, row) => Math.max(max, row.length), 0
            );

            ranges.push(GridAddress.range(
                block.grid,
                start.col,
                start.row,
                width,
                block.rows.length
            ));

            indices.push(index);
        });

        // 2. Fetch all requested data in one batch
        if (ranges.length) {
            const blocks = await this.read(ranges);

            blocks.forEach((block, index) => {
                const originalIndex = indices[index];
                const length = requests[originalIndex].block.rows.length;

                results[originalIndex] = {
                    ...block,
                    rows: Array.from(
                        { length },
                        (_, row) => block.rows[row] ?? []
                    )
                };
            });
        }

        return results;
    }

    async write<const Requests extends readonly GridWriteRequest[]>(
        requests: Requests
    ): Promise<GridWriteResults<Requests>> {
        if (!requests.length)
            return [] as unknown as GridWriteResults<Requests>;

        const plan = planWrites(requests);

        const locations = await this.#executePlan(plan);

        return await this.#resolveResults(requests, locations) as GridWriteResults<Requests>;
    }

    invalidate(): void {
        this.#sheetIds = undefined;
    }
}