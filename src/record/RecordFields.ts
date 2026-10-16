import { DateTime } from 'luxon';

import { RecordFieldBuilder } from "./RecordSchema";
import { Result } from "../util";


/* Helpers */
const expected = (received: any, ...expected: string[]) =>
    Result.failure(`Expected ${expected.length === 1 ? expected[0] : expected.join('|')}, but received '${received}'`);

const numberPattern = /^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

const parseNumber = (value: string) => {
    const text = value.trim();

    if (!numberPattern.test(text))
        return expected(value, 'a number');

    const parsed = Number(text.replaceAll(',', ''));

    return Number.isFinite(parsed)
        ? Result.success(parsed)
        : expected(value, 'a number');
};


const integerPattern = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)$/;

const parseInteger = (value: string) => {
    const text = value.trim();

    if (!integerPattern.test(text))
        return expected(value, 'a safe integer');

    const parsed = Number(text.replaceAll(',', ''));

    return Number.isSafeInteger(parsed)
        ? Result.success(parsed)
        : expected(value, 'a safe integer');
};


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
        value => typeof value === 'number' && Number.isFinite(value)
            ? Result.success(value)
            : expected(value, 'a number'),
        parseNumber,
        value => value
    );

export const integerField = <const Name extends string>(name: Name) =>
    new RecordFieldBuilder(
        name,
        false,
        value => typeof value === 'number' && Number.isSafeInteger(value)
            ? Result.success(value)
            : expected(value, 'a safe integer'),
        parseInteger,
        value => value
    );

export const bigintField = <const Name extends string>(name: Name) =>
    new RecordFieldBuilder(
        name,
        false,
        value => typeof value === 'bigint'
            ? Result.success(value)
            : expected(value, 'a bigint'),
        value => {
            if (typeof value !== 'string' || !integerPattern.test(value.trim()))
                return expected(value, 'a bigint');

            return Result.success(BigInt(value.trim().replaceAll(',', '')));
        },
        value => value == null ? value : value.toString()
    );

export const stringField = <const Name extends string>(name: Name) =>
    new RecordFieldBuilder(
        name,
        false,
        (value => typeof value === 'string' ? Result.success(value) : expected(value, 'a string')),
        (value => Result.success(value)),
        (value => value)
    );

/* Temporal Fields */

// JS Date
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

// Luxon DateTime
export type DateTimeOptions = {
    formats?: readonly string[];
    locale?: string;
    zone?: string;
};

const datetimeParser = ({ formats = [], locale = 'en-US', zone = 'UTC' }: DateTimeOptions) => (value: unknown) => {
    if (typeof value !== 'string')
        return expected(value, 'a date/time');

    const iso = DateTime.fromISO(value, { zone, setZone: true });

    if (iso.isValid)
        return Result.success(iso);

    for (const format of formats) {
        const parsed = DateTime.fromFormat(value, format, {
            locale,
            zone,
            setZone: true
        });

        if (parsed.isValid)
            return Result.success(parsed);
    }

    return expected(value, 'a date/time');
};

export const datetimeField = <const Name extends string>(
    name: Name,
    options: DateTimeOptions = {}
) => {
    const parser = datetimeParser(options);

    return new RecordFieldBuilder<Name, DateTime>(
        name,
        false,
        value => DateTime.isDateTime(value) && value.isValid
            ? Result.success(value)
            : expected(value, 'a valid DateTime'),
        parser,
        value => value == null ? value : value.toISO({ extendedZone: true })
    );
};


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

