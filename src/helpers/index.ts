import { RecordBook } from '../record/RecordBook';
import { RecordField, RecordFieldBuilder, RecordGroupBuilder, RecordProcessor, RecordSchema } from '../record/RecordSchema';
import { RecordStore } from '../record/RecordStore';
import { RecordTable } from '../record/RecordTable';

export const book = <const Tables extends readonly RecordTable<any, RecordSchema>[]>(store: RecordStore<Tables>) =>
    new RecordBook(store);

export const table = <const Name extends string, const Schema extends RecordSchema>(name: Name, schema: Schema) =>
    new RecordTable(name, schema);

export const group = <const Fields extends RecordField<any, any, any>[]>(fields: Fields) => <const Name extends string>(name: Name) =>
    new RecordGroupBuilder(name, false, fields);

export const field = <const Name extends string, Type>(name: Name, processor: RecordProcessor<Type>) =>
    new RecordFieldBuilder(name, false, processor.validate, processor.parse, processor.encode);

export {
    booleanField as boolean,
    numberField as number,
    currencyField as currency,
    percentField as percent,
    stringField as string,
    enumField as enum,
    phoneField as phone,
    dateField as date
} from '../record/RecordFields';

export * as grid from './grid';