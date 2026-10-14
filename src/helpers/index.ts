import { RecordBook } from '../record/RecordBook';
import { RecordField, RecordFieldBuilder, RecordGroupBuilder, RecordGroupFactory, RecordProcessor, RecordSchema, typeOnly } from '../record/RecordSchema';
import { RecordStore } from '../record/RecordStore';
import { RecordTable } from '../record/RecordTable';

export const book = <const Tables extends readonly RecordTable<any, RecordSchema>[]>(store: RecordStore<Tables>) =>
    new RecordBook(store);

export const table = <const Name extends string, const Schema extends RecordSchema>(name: Name, schema: Schema) =>
    new RecordTable(name, schema);

export function group<const Fields extends RecordField<any, any, any>[]>(fields: Fields): RecordGroupFactory<Fields>;
export function group<const Name extends string, const Fields extends RecordField<any, any, any>[]>(
    name: Name, fields: Fields): RecordGroupBuilder<Name, Fields, false>;
export function group(
    nameOrFields: string | RecordField<any, any, any>[],
    fields?: RecordField<any, any, any>[]
) {
    if (typeof nameOrFields === 'string')
        return new RecordGroupBuilder(nameOrFields, false, fields!);

    const factory = (name: string) =>
        new RecordGroupBuilder(name, false, nameOrFields);

    return Object.defineProperty(factory, 'type', { get: typeOnly });
}

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