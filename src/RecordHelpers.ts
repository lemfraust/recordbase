import { Result } from "./Result";
import { RecordField } from "./RecordField";
import { RecordFieldBuilder, RecordGroupBuilder } from "./RecordBuilders";
import { RecordParser, RecordProcessor } from "./RecordProcessor";
import { RecordSchema } from "./RecordSchema";
import { RecordTable } from "./RecordTable";


const table = <const Name extends string, const Schema extends RecordSchema>(name: Name, schema: Schema) =>
    new RecordTable(name, schema);

const group = <const Fields extends RecordField<any, any, any>[]>(fields: Fields) => <const Name extends string>(name: Name) =>
    new RecordGroupBuilder(name, false, fields);

const field = <const Name extends string, Type>(name: Name, processor: RecordProcessor<Type>) =>
    new RecordFieldBuilder(name, false, processor.validate, processor.parse, processor.encode);


const expected = (received: any, ...expected: string[]) =>
    Result.failure(`Expected ${expected.length === 1 ? expected[0] : expected.join('|')}, but received '${received}'`);


const booleanField = <const Name extends string>(name: Name, processor?: Partial<RecordProcessor<boolean>>) =>
    new RecordFieldBuilder(
        name,
        false,
        processor?.validate ?? (value => typeof value === 'boolean' ? Result.success(value) : expected(value, 'a boolean')),
        processor?.parse ?? (value => value === 'TRUE' ? Result.success(true) : value === 'FALSE' ? Result.success(false) : expected(value, 'TRUE', 'FALSE')),
        processor?.encode ?? (value => value)
    );


const numberField = <const Name extends string>(name: Name, processor?: Partial<RecordProcessor<number>>) =>
    new RecordFieldBuilder(
        name,
        false,
        processor?.validate ?? (value => typeof value === 'number' ? Result.success(value) : expected(value, 'a number')),
        processor?.parse ?? (value => {
            const parsed = parseFloat(value.replaceAll(',', ''));

            return isNaN(parsed)
                ? expected(value, 'a number')
                : Result.success(parsed);
        }),
        processor?.encode ?? (value => value)
    );


const currencyField = <const Name extends string>(name: Name, processor?: Partial<RecordProcessor<number>>) =>
    new RecordFieldBuilder(
        name,
        false,
        processor?.validate ?? (value => typeof value === 'number' ? Result.success(value) : expected(value, 'a number')),
        processor?.parse ?? (value => {
            const parsed = parseFloat(value.replace('$', '').replaceAll(',', ''));

            return isNaN(parsed)
                ? expected(value, 'a number')
                : Result.success(parsed);
        }),
        processor?.encode ?? (value => value)
    );


const percentField = <const Name extends string>(name: Name, processor?: Partial<RecordProcessor<number>>) =>
    new RecordFieldBuilder(
        name,
        false,
        processor?.validate ?? (value => typeof value === 'number' ? Result.success(value) : expected(value, 'a number')),
        processor?.parse ?? (value => {
            const hasPercent = value.endsWith('%');
            const parsed = parseFloat(value.replace('%', '').replaceAll(',', ''));

            return isNaN(parsed)
                ? expected(value, 'a number')
                : Result.success(parsed / (hasPercent ? 100 : 1));
        }),
        processor?.encode ?? (value => value)
    );


const stringField = <const Name extends string>(name: Name, processor?: Partial<RecordProcessor<string>>) =>
    new RecordFieldBuilder(
        name,
        false,
        processor?.validate ?? (value => typeof value === 'string' ? Result.success(value) : expected(value, 'a string')),
        processor?.parse ?? (value => Result.success(value)),
        processor?.encode ?? (value => value)
    );


const enumParser = <const Enum extends readonly string[]>(values: Enum, caseSensitive: boolean) => {
    const find = caseSensitive
        ? (value: string) => values.find(item => item === value)
        : (value: string) => values.find(item => item.toLowerCase() === value.toLowerCase());

    return (value: string) => {
        const match = find(value);

        return match !== undefined
            ? Result.success(match)
            : expected(value, ...values);
    };
};

const enumField = <const Name extends string, const Enum extends readonly string[]>(name: Name, values: Enum, caseSensitive: boolean = false) => {
    const parser = enumParser(values, caseSensitive);

    return new RecordFieldBuilder(name, false, parser, parser, value => value);
};


export type PhoneFormatter = (phone: { area: string, start: string, end: string; }) => string;

const defaultPhoneFormat: PhoneFormatter = ({ area, start, end }) => `(${area}) ${start}-${end}`;

const getPhoneNumber = (text: string, format: PhoneFormatter = defaultPhoneFormat): string | undefined => {
    const [result, area, start, end] =
        text.match(/^ *\((\d{3})\) *(\d{3}) *-? *(\d{4}) *$/) ||
        text.match(/^ *(\d{3}) *[ .-]? *(\d{3}) *[.-]? *(\d{4}) *$/) ||
        [];

    if (result)
        return format({ area, start, end });
};

const phoneParser = (format?: PhoneFormatter) => (value: string) => {
    const phone = getPhoneNumber(value, format);

    return phone
        ? Result.success(phone)
        : expected(value, 'a phone number');
};

const phoneField = <const Name extends string>(name: Name, format?: PhoneFormatter) => {
    const parser = phoneParser(format);

    return new RecordFieldBuilder(name, false, parser, parser, value => value);
};


const defaultDateParser: RecordParser<Date> = (value: string) => {
    const parsed = new Date(value);

    return isNaN(parsed.getTime())
        ? expected(value, 'a date')
        : Result.success(parsed);
};

const dateField = <const Name extends string>(name: Name, parser?: RecordParser<Date>) =>
    new RecordFieldBuilder(
        name,
        false,
        value => value instanceof Date && !isNaN(value.getTime()) ? Result.success(value) : expected(value, 'a date'),
        parser ?? defaultDateParser,
        value => value
    );


export {
    table,
    group,
    field,
    booleanField as boolean,
    numberField as number,
    currencyField as currency,
    percentField as percent,
    stringField as string,
    enumField as enum,
    phoneField as phone,
    dateField as date
};