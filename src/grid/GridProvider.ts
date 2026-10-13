import { RecordReturn, RecordReturnData, RecordReturnRef } from "../record/RecordOperations";
import { GridCoordinate, GridRange } from "./GridAddress";
import { GridReadBlock, GridWriteBlock } from "./GridBlock";

export type GridWriteRequest<Returns extends RecordReturn = RecordReturn> = {
    block: GridWriteBlock;
    returns: Returns;
};

export type GridWriteResult<Returns extends RecordReturn> =
    Returns extends RecordReturnData
        ? GridReadBlock
        : Returns extends RecordReturnRef
            ? GridCoordinate
            : undefined;

export type GridWriteResults<Requests extends readonly GridWriteRequest[]> = {
        [Index in keyof Requests]:
            Requests[Index] extends GridWriteRequest<infer Returns>
                ? GridWriteResult<Returns>
                : never;
    };

/* Provider */
export interface GridProvider {
    read(ranges: readonly GridRange[]): Promise<GridReadBlock[]>;

    write<const Requests extends readonly GridWriteRequest[]>
        (requests: Requests)
        : Promise<GridWriteResults<Requests>>;

    invalidate(): void;
};