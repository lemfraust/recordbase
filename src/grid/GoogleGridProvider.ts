import { sheets_v4 } from "@googleapis/sheets";

import { execute, ExecutorHandler, lazy, Lazy, Resolvable, retryHandler } from "../util";
import { GridAddress, GridCoordinate, GridRange } from "./GridAddress";
import { GridBlock, GridFetchBlock, GridSetBlock, GridValue } from "./GridBlock";
import { GridProvider, GridSetRequest, GridSetResults } from "./GridProvider";

export type GoogleApi = sheets_v4.Sheets;

export type GoogleGridProviderOptions = {
    id: string;
    api: Resolvable<GoogleApi>;
    handlers?: ExecutorHandler | GoogleGridProviderHandlerOptions;
};

export type GoogleGridProviderHandlerOptions = {
    default?: ExecutorHandler;
    fetch?: ExecutorHandler;
    set?: ExecutorHandler;
    info?: ExecutorHandler;
};

type GoogleGridProviderHandlers = Required<Omit<GoogleGridProviderHandlerOptions, 'default'>>;

const noRetry: ExecutorHandler = () => undefined;

const retry = retryHandler({ attempts: 3, wait: 1000 });

const defaultHandlers: GoogleGridProviderHandlers = {
    fetch: retry,
    set: noRetry,
    info: retry
};

const resolveHandlers = (handlers: GoogleGridProviderOptions['handlers']): GoogleGridProviderHandlers => {
    if (typeof handlers === 'function')
        return { fetch: handlers, set: handlers, info: handlers };

    const resolve = (key: keyof GoogleGridProviderHandlers): ExecutorHandler =>
        handlers?.[key] ?? handlers?.default ?? defaultHandlers[key];

    return { fetch: resolve('fetch'), set: resolve('set'), info: resolve('info') };
};

// Google Specific Helpers
const encodeGridName = (name: string): string => `'${name.replaceAll("'", "''")}'`;

const dateToSerialNumber = (date: Date): number => {
    const epoch = new Date(1899, 11, 30);
    return (date.getTime() - epoch.getTime()) / 86400000;
};

const toGoogleCellValue = (value: GridValue): sheets_v4.Schema$ExtendedValue | undefined => {
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


// GoogleGridProvider
export class GoogleGridProvider implements GridProvider {
    readonly #id: string;
    readonly #api: Lazy<GoogleApi>;
    readonly #handlers: GoogleGridProviderHandlers;

    #sheetIds?: Lazy<Map<string, number>>;


    constructor(options: GoogleGridProviderOptions) {
        this.#id = options.id;
        this.#api = lazy(options.api);
        this.#handlers = resolveHandlers(options.handlers);
    }


    async fetch(ranges: readonly GridRange[]): Promise<GridFetchBlock[]> {
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
        }), this.#handlers.fetch);

        // translate results into GridFetchBlocks
        const values = response.data.valueRanges ?? [];

        return ranges.map((range, index) => ({
            grid: range.grid,
            start: range.from,
            rows: (values[index]?.values ?? []) as string[][]
        }));
    }

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

    async set<const Requests extends readonly GridSetRequest[]>(
        requests: Requests
    ): Promise<GridSetResults<Requests>> {        
        throw new Error("Not implemented");
    }

    invalidate(): void {
        this.#sheetIds = undefined;
    }
}