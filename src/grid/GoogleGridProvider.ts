import { sheets_v4 } from "@googleapis/sheets";

import { ExecutorHandler, retryHandler } from "../Executor";
import { GridRange } from "./GridAddress";
import { GridFetchBlock } from "./GridBlock";
import { GridProvider, GridSetRequest, GridSetResults } from "./GridProvider";

export type GoogleApi = sheets_v4.Sheets;



export type GoogleGridProviderOptions = {
    id: string;
    api: GoogleApi;
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


export class GoogleGridProvider implements GridProvider {
    readonly #id: string;
    readonly #api: GoogleApi;
    readonly #handler?: ExecutorHandler;

    #sheetIds?: Map<string, number>;

    constructor(id: string, api: GoogleApi, handler?: ExecutorHandler) {
        this.#id = id;
        this.#api = api;
        this.#handler = handler;
    }

    async fetch(ranges: readonly GridRange[]): Promise<GridFetchBlock[]> {

        // 1. translate ranges into Google A1 notation
        // 2. execute batchGet with executor
        // 3. tralsate results into GridFetchBlocks

        throw new Error("Not implemented");
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