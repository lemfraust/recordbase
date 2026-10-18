import { RecordBook } from '../record/RecordBook';
import { RecordField, RecordFieldBuilder, RecordGroupBuilder, RecordGroupFactory, RecordProcessor, RecordSchema, RecordTable, typeOnly, validateSchema } from '../record/RecordSchema';
import { RecordStore } from '../record/RecordStore';
import { freeze } from '../util';

// Book
export const book = <const Tables extends readonly RecordTable[]>(store: RecordStore<Tables>) => new RecordBook(store);

// Table
export function table<const Name extends string, const Schema extends RecordSchema>(name: Name, schema: Schema): RecordTable<Name, Schema>;
export function table<const Name extends string, const Fields extends RecordField<any, any, any>[]>(name: Name, group: RecordGroupFactory<Fields>): RecordTable<Name, Fields>;
export function table(name: string, source: RecordSchema | RecordGroupFactory<any>) {
    return new RecordTable(name, typeof source === 'function' ? source.fields as RecordSchema : source);
}

// Group
export function group<const Fields extends RecordField<any, any, any>[]>(fields: Fields): RecordGroupFactory<Fields>;
export function group<const Name extends string, const Fields extends RecordField<any, any, any>[]>
    (name: Name, fields: Fields): RecordGroupBuilder<Name, Fields, false>;
export function group<const Fields extends RecordField<any, any, any>[]>(nameOrFields: string | Fields, fields?: Fields) {
    if (typeof nameOrFields === 'string')
        return new RecordGroupBuilder(nameOrFields, fields!, false);

    const items = freeze([...nameOrFields]) as unknown as Fields;

    const factory = <const Name extends string>(name: Name) =>
        new RecordGroupBuilder(name, items, false);

    Object.defineProperties(factory, {
        fields: { value: items },
        type: { get: typeOnly },
        patch: { get: typeOnly },
        validate: { value: (value: unknown) => validateSchema(items, value) },
        [Symbol.iterator]: { value: () => items[Symbol.iterator]() },
    });

    return freeze(factory) as RecordGroupFactory<Fields>;
}

// Field
export const field = <const Name extends string, Type>(name: Name, processor: RecordProcessor<Type>) =>
    new RecordFieldBuilder(name, processor.validate, processor.parse, processor.encode, false);

// Field Helpers
export {
    booleanField as boolean,
    numberField as number,
    integerField as integer,
    stringField as string,

    dateField as date,
    datetimeField as datetime,

    currencyField as currency,
    percentField as percent,

    enumField as enum,
    emailField as email,
    phoneField as phone,
} from '../record/RecordFields';

// Grid
export * as grid from './grid';
