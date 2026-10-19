import { DateTime } from 'luxon';

import { RecordDate, RecordFieldBuilder, RecordTemporalKind, RecordTemporalValue, RecordTime } from "./RecordSchema";
import { Result } from "../util";
import isEmail, { IsEmailOptions } from 'validator/lib/isEmail';
import isURL from 'validator/lib/isURL';
import { IsURLOptions } from 'validator';


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
        (value => typeof value === 'boolean' ? Result.success(value) : expected(value, 'a boolean')),
        (value => value === 'TRUE' ? Result.success(true) : value === 'FALSE' ? Result.success(false) : expected(value, 'TRUE', 'FALSE')),
        (value => value),
        false,
    );

export const numberField = <const Name extends string>(name: Name) =>
    new RecordFieldBuilder(
        name,
        value => typeof value === 'number' && Number.isFinite(value)
            ? Result.success(value)
            : expected(value, 'a number'),
        parseNumber,
        value => value,
        false,
    );

export const integerField = <const Name extends string>(name: Name) =>
    new RecordFieldBuilder(
        name,
        value => typeof value === 'number' && Number.isSafeInteger(value)
            ? Result.success(value)
            : expected(value, 'a safe integer'),
        parseInteger,
        value => value,
        false,
    );

export const bigintField = <const Name extends string>(name: Name) =>
    new RecordFieldBuilder(
        name,
        value => typeof value === 'bigint'
            ? Result.success(value)
            : expected(value, 'a bigint'),
        value => {
            if (typeof value !== 'string' || !integerPattern.test(value.trim()))
                return expected(value, 'a bigint');

            return Result.success(BigInt(value.trim().replaceAll(',', '')));
        },
        value => value == null ? value : value.toString(),
        false,
    );

export const stringField = <const Name extends string>(name: Name) =>
    new RecordFieldBuilder(
        name,
        (value => typeof value === 'string' ? Result.success(value) : expected(value, 'a string')),
        (value => Result.success(value)),
        (value => value),
        false,
    );

/* Temporal Fields */
const encodeTemporal = (
    kind: RecordTemporalKind,
    date: RecordDate = { year: 1970, month: 1, day: 1 },
    time: RecordTime = { hour: 0 },
    zone: string = 'UTC'
): RecordTemporalValue => {
    switch (kind) {
        case 'date':
            return { kind, date };
        case 'time':
            return { kind, time };
        case 'datetime':
            return { kind, date, time };
        case 'zonedatetime':
            return { kind, date, time, zone };
    }
};

const parseTemporal = (value: unknown, kind: RecordTemporalKind, defaultZone: string = 'UTC'): DateTime | undefined => {

    if (!value || typeof value !== 'object' || !('kind' in value) || value.kind !== kind)
        return undefined;

    const temporal = value as RecordTemporalValue;

    const date: RecordDate = 'date' in temporal ? temporal.date : { year: 1970, month: 1, day: 1 };

    const time: RecordTime = 'time' in temporal ? temporal.time : { hour: 0 };

    if (!date || !time)
        return undefined;

    const zone = temporal.kind === 'zonedatetime' ? temporal.zone : defaultZone;

    if (typeof zone !== 'string')
        return undefined;

    // Luxon expects UTC+03:00 rather than a bare +03:00 zone.
    const luxonZone = /^[+-]\d{2}:\d{2}$/.test(zone) ? `UTC${zone}` : zone;

    try {
        const parsed = DateTime.fromObject({
            year: date.year,
            month: date.month,
            day: date.day,
            hour: time.hour,
            minute: time.minute ?? 0,
            second: time.second ?? 0,
            millisecond: time.millisecond ?? 0
        }, { zone: luxonZone });

        if (!parsed.isValid ||
            parsed.year !== date.year ||
            parsed.month !== date.month ||
            parsed.day !== date.day ||
            parsed.hour !== time.hour ||
            parsed.minute !== (time.minute ?? 0) ||
            parsed.second !== (time.second ?? 0) ||
            parsed.millisecond !== (time.millisecond ?? 0))
            return undefined;

        return parsed;
    }
    catch {
        return undefined;
    }
};

// JS Date
export function jsdateField<const Name extends string>(name: Name, kind: Exclude<RecordTemporalKind, 'zonedatetime'>): RecordFieldBuilder<Name, Date>;
export function jsdateField<const Name extends string>(name: Name, kind: 'zonedatetime', zone: string): RecordFieldBuilder<Name, Date>;
export function jsdateField<const Name extends string>(name: Name, kind: RecordTemporalKind, zone?: string): RecordFieldBuilder<Name, Date> {
    const storedKind = kind === 'zonedatetime' ? 'datetime' : kind;

    return new RecordFieldBuilder<Name, Date>(
        name,
        value => value instanceof Date && !isNaN(value.getTime())
            ? Result.success(value)
            : expected(value, 'a date'),
        value => {
            const parsed = parseTemporal(value, storedKind, zone ?? 'local');

            return parsed
                ? Result.success(parsed.toJSDate())
                : expected(value, `a ${storedKind}`);
        },
        value => {
            if (value == null)
                return value;

            // A JS Date is an instant. Use the requested zone when available; otherwise use the runtime's local timezone.
            const dt = DateTime.fromJSDate(value, { zone: zone ?? 'local' });

            return encodeTemporal(
                kind,
                {
                    year: dt.year,
                    month: dt.month,
                    day: dt.day
                },
                {
                    hour: dt.hour,
                    minute: dt.minute,
                    second: dt.second,
                    millisecond: dt.millisecond
                },
                zone
            );
        },
        false
    );
}

// Luxon DateTime
export function datetimeField<const Name extends string>(name: Name, kind: Exclude<RecordTemporalKind, 'zonedatetime'>): RecordFieldBuilder<Name, DateTime>;
export function datetimeField<const Name extends string>(name: Name, kind: 'zonedatetime', zone?: string): RecordFieldBuilder<Name, DateTime>;
export function datetimeField<const Name extends string>(name: Name, kind: RecordTemporalKind, zone?: string): RecordFieldBuilder<Name, DateTime> {
    const storedKind = kind === 'zonedatetime' && zone !== undefined
        ? 'datetime'
        : kind;

    return new RecordFieldBuilder<Name, DateTime>(
        name,
        value => DateTime.isDateTime(value) && value.isValid
            ? Result.success(value)
            : expected(value, 'a valid DateTime'),
        value => {
            const parsed = parseTemporal(value, storedKind, zone);

            return parsed
                ? Result.success(parsed)
                : expected(value, `a ${storedKind}`);
        },
        value => {
            if (value == null)
                return value;

            const dt = zone ? value.setZone(zone) : value;

            if (!dt.isValid)
                throw new Error(`Invalid timezone: ${zone}`);

            return encodeTemporal(
                storedKind,
                {
                    year: dt.year,
                    month: dt.month,
                    day: dt.day
                },
                {
                    hour: dt.hour,
                    minute: dt.minute,
                    second: dt.second,
                    millisecond: dt.millisecond
                },
                dt.zone.type === 'fixed' && dt.offset !== 0
                    ? dt.toFormat('ZZ')
                    : dt.zoneName ?? 'UTC'
            );
        },
        false
    );
}

/* Specialized Number Fields */
export const currencyField = <const Name extends string>(name: Name) =>
    new RecordFieldBuilder(
        name,
        value => typeof value === 'number' && Number.isFinite(value)
            ? Result.success(value)
            : expected(value, 'a number'),
        value => {
            if (typeof value !== 'string')
                return expected(value, 'a currency amount');

            const text = value.trim();

            // Allow an optional sign before the dollar symbol, never after it.
            const match = /^([+-]?)\$([\d.,]+)$/.exec(text);

            const result = parseNumber(match ? `${match[1]}${match[2]}` : text);

            return result.success
                ? result
                : expected(value, 'a currency amount');
        },
        value => value,
        false,
    );

export const percentField = <const Name extends string>(name: Name) =>
    new RecordFieldBuilder(
        name,
        value => typeof value === 'number' && Number.isFinite(value)
            ? Result.success(value)
            : expected(value, 'a number'),
        value => {
            if (typeof value !== 'string')
                return expected(value, 'a percentage');

            const text = value.trim();

            // Only allow a percent sign immediately after the number.
            const match = /^([+-]?[\d.,]+)%$/.exec(text);

            const result = parseNumber(match ? match[1] : text);

            return result.success
                ? Result.success(result.value / (match ? 100 : 1))
                : expected(value, 'a percentage');
        },
        value => value,
        false,
    );


/* Specialized String Fields */

// Enum
const enumParser = <const Enum extends readonly string[]>(values: Enum, caseSensitive: boolean) => {
    const choices: readonly Enum[number][] = values;

    const find = caseSensitive
        ? (value: string) => choices.find(item => item === value)
        : (value: string) => choices.find(item => item.toLowerCase() === value.toLowerCase());

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

    return new RecordFieldBuilder(name, parser, parser, value => value, false);
};


// Email
export type EmailOptions = IsEmailOptions;

const makeEmailParser = (options?: EmailOptions) =>
    (value: unknown) =>
        typeof value === 'string' && isEmail(value, options) ? Result.success(value) : expected(value, 'an email address');

export const emailField = <const Name extends string>(name: Name, options?: EmailOptions) => {
    const parser = makeEmailParser(options);

    return new RecordFieldBuilder(
        name,
        parser,
        parser,
        value => value,
        false,
    );
};

// Url
export type UrlOptions = IsURLOptions;

const makeUrlParser = (options?: UrlOptions) =>
    (value: unknown) =>
        typeof value === 'string' && isURL(value, options) ? Result.success(value) : expected(value, 'a Url');

export const urlField = <const Name extends string>(name: Name, options?: UrlOptions) => {
    const parser = makeUrlParser(options);

    return new RecordFieldBuilder(
        name,
        parser,
        parser,
        value => value,
        false,
    );
};


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

    return new RecordFieldBuilder(name, parser, parser, value => value, false);
};

