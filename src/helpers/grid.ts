import { GoogleGridProvider, GoogleGridProviderOptions } from '../grid/GoogleGridProvider';
import { GridProvider } from '../grid/GridProvider';
import { GridRecordStore, GridTablesOf, GridTableSource } from '../grid/GridRecordStore';
import { RecordTable } from '../record/RecordSchema';

export const google = (options: GoogleGridProviderOptions) =>
    new GoogleGridProvider(options);


export const store = <const Sources extends readonly GridTableSource<RecordTable>[]>(
    provider: GridProvider,
    sources: Sources
) => new GridRecordStore(provider, sources) as GridRecordStore<GridTablesOf<Sources>>;
