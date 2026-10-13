import { sheets_v4 } from "@googleapis/sheets";

import { execute, ExecutorHandler, lazy, Lazy, Resolvable, retryHandler } from "../util";
import { GridAddress, GridRange } from "./GridAddress";
import { GridFetchBlock } from "./GridBlock";
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

const encodeGridName = (name: string): string => `'${name.replaceAll("'", "''")}'`;


export class GoogleGridProvider implements GridProvider {
    readonly #id: string;
    readonly #api: Lazy<GoogleApi>;
    readonly #handlers: GoogleGridProviderHandlers;

    #sheetIds?: Map<string, number>;

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

    async set<const Requests extends readonly GridSetRequest[]>(
        requests: Requests
    ): Promise<GridSetResults<Requests>> {

        // 1. translate grid names to Google sheet IDs
        // 2. translate GridSetBlocks into Google requests
        // 3. executee batches with executor
        // 4. resolve results as Ref/Data/undefined

        throw new Error("Not implemented");
    }

    invalidate(): void {
        this.#sheetIds = undefined;
    }
}