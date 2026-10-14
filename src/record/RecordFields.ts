import { RecordFieldBuilder } from "./RecordSchema";
import { Result } from "../util";


/* Helper */
const expected = (received: any, ...expected: string[]) =>
    Result.failure(`Expected ${expected.length === 1 ? expected[0] : expected.join('|')}, but received '${received}'`);


/* Primitive Fields */
export const booleanField = <const Name extends string>(name: Name) =>
    new RecordFieldBuilder(
        name,
        false,
        (value => typeof value === 'boolean' ? Result.success(value) : expected(value, 'a boolean')),
        (value => value === 'TRUE' ? Result.success(true) : value === 'FALSE' ? Result.success(false) : expected(value, 'TRUE', 'FALSE')),
        (value => value)
    );

export const numberField = <const Name extends string>(name: Name) =>
    new RecordFieldBuilder(
        name,
        false,
        (value => typeof value === 'number' ? Result.success(value) : expected(value, 'a number')),
        (value => {
            const parsed = parseFloat(value.replaceAll(',', ''));

            return isNaN(parsed)
                ? expected(value, 'a number')
                : Result.success(parsed);
        }),
        (value => value)
    );

export const stringField = <const Name extends string>(name: Name) =>
    new RecordFieldBuilder(
        name,
        false,
        (value => typeof value === 'string' ? Result.success(value) : expected(value, 'a string')),
        (value => Result.success(value)),
        (value => value)
    );

export const dateField = <const Name extends string>(name: Name) =>
    new RecordFieldBuilder(
        name,
        false,
        value => value instanceof Date && !isNaN(value.getTime()) ? Result.success(value) : expected(value, 'a date'),
        (value: string) => {
            const parsed = new Date(value);
            return isNaN(parsed.getTime()) ? expected(value, 'a date') : Result.success(parsed);
        },
        value => value
    );


/* Specialized Number Fields */
export const currencyField = <const Name extends string>(name: Name) =>
    new RecordFieldBuilder(
        name,
        false,
        (value => typeof value === 'number' ? Result.success(value) : expected(value, 'a number')),
        (value => {
            const parsed = parseFloat(value.replace('$', '').replaceAll(',', ''));

            return isNaN(parsed)
                ? expected(value, 'a number')
                : Result.success(parsed);
        }),
        (value => value)
    );


export const percentField = <const Name extends string>(name: Name) =>
    new RecordFieldBuilder(
        name,
        false,
        (value => typeof value === 'number' ? Result.success(value) : expected(value, 'a number')),
        (value => {
            const hasPercent = value.endsWith('%');
            const parsed = parseFloat(value.replace('%', '').replaceAll(',', ''));

            return isNaN(parsed)
                ? expected(value, 'a number')
                : Result.success(parsed / (hasPercent ? 100 : 1));
        }),
        (value => value)
    );



/* Specialized String Fields */

// Enum
const enumParser = <const Enum extends readonly string[]>(values: Enum, caseSensitive: boolean) => {
    const find = caseSensitive
        ? (value: string) => values.find(item => item === value)
        : (value: string) => values.find(item => item.toLowerCase() === value.toLowerCase());

    return (value: unknown) => {
        if (typeof value !== 'string')
            return expected(value, ...values);

        const match = find(value);

        return match !== undefined
            ? Result.success(match)
            : expected(value, ...values);
    };
};
export const enumField = <const Name extends string, const Enum extends readonly string[]>(name: Name, values: Enum, caseSensitive: boolean = false) => {
    const parser = enumParser(values, caseSensitive);

    return new RecordFieldBuilder(name, false, parser, parser, value => value);
};


// Email
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emailParser = (value: unknown) =>
    typeof value === 'string' && emailPattern.test(value)
        ? Result.success(value)
        : expected(value, 'an email address');

export const emailField = <const Name extends string>(name: Name) => new RecordFieldBuilder(
    name,
    false,
    emailParser,
    emailParser,
    (value => value)
);

// Phone
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

const phoneParser = (format?: PhoneFormatter) => (value: unknown) => {
    if (typeof value !== 'string')
        return expected(value, 'a phone number');

    const phone = getPhoneNumber(value, format);

    return phone
        ? Result.success(phone)
        : expected(value, 'a phone number');
};

export const phoneField = <const Name extends string>(name: Name, format?: PhoneFormatter) => {
    const parser = phoneParser(format);

    return new RecordFieldBuilder(name, false, parser, parser, value => value);
};

