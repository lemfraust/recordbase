import { GridCoordinate, GridRange } from "./GridAddress";
import { GridFetchBlock, GridSetBlock } from "./GridBlock";

export interface GridProvider {
    fetch(ranges: readonly GridRange[]): Promise<GridFetchBlock[]>;

    set(blocks: readonly GridSetBlock[]): Promise<GridCoordinate[]>;

    invalidate(): void;
}