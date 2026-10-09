import { RecordReturn, RecordReturnData, RecordReturnRef } from "../RecordOperations";
import { GridCoordinate, GridRange } from "./GridAddress";
import { GridFetchBlock, GridSetBlock } from "./GridBlock";

export type GridSetRequest<Returns extends RecordReturn = RecordReturn> = {
    block: GridSetBlock;
    returns: Returns;
};

export type GridSetResult<Returns extends RecordReturn> =
    Returns extends RecordReturnData
        ? GridFetchBlock
        : Returns extends RecordReturnRef
            ? GridCoordinate
            : undefined;

export type GridSetResults<    Requests extends readonly GridSetRequest[]> = {
        [Index in keyof Requests]:
            Requests[Index] extends GridSetRequest<infer Returns>
                ? GridSetResult<Returns>
                : never;
    };

/* Provider */
export interface GridProvider {
    fetch(ranges: readonly GridRange[]): Promise<GridFetchBlock[]>;

    set<const Requests extends readonly GridSetRequest[]>
        (requests: Requests)
        : Promise<GridSetResults<Requests>>;

    invalidate(): void;
};