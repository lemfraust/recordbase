import { DateTime } from 'luxon';

import { IsURLOptions } from 'validator';
import isEmail, { IsEmailOptions } from 'validator/lib/isEmail';
import isURL from 'validator/lib/isURL';
import { Result } from "../util";
import { RecordDate, RecordFieldBuilder, RecordTemporalKind, RecordTemporalValue, RecordTime } from "./RecordSchema";


/* Helpers */
const expected = (received: any, ...expected: string[]) =>
    Result.failure(`Expected ${expected.length === 1 ? expected[0] : expected.join('|')}, but received '${received}'`);


const parseNumeric = (value: string, pattern: RegExp, error: string, validator: (value: number) => boolean) => {
    const text = value.trim();

    if (pattern.test(text)) {
        const parsed = Number(text.replaceAll(',', ''));

        if (validator(parsed))
            return Result.success(parsed);
    }

    return expected(value, error);
};

const numberPattern = /^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

const parseNumber = (value: string) => parseNumeric(value, numberPattern, 'a number', Number.isFinite);


const integerPattern = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)$/;

const getIntegerError = (unsafe: boolean) => `a${unsafe ? 'n' : ' safe'} integer`;

const getIntegerValidator = (unsafe: boolean) => unsafe ? Number.isInteger : Number.isSafeInteger;

const parseInteger = (value: string, unsafe: boolean = false) =>
    parseNumeric(value, integerPattern, getIntegerError(unsafe), getIntegerValidator(unsafe));



/* Primitive Fields */
export const booleanField = <const Name extends string>(name: Name) => {
    const error = 'a boolean';

    return new RecordFieldBuilder(
        name,
        (value => typeof value === 'boolean' ? Result.success(value) : expected(value, error)),
        value => {
            switch (typeof value) {
                case 'boolean':
                    return Result.success(value);
                case 'number':
                    if (isFinite(value))
                        return Result.success(value > 0);
                    break;
                case 'string': {
                    const text = value.trim().toLowerCase();

                    if (text === 'true') return Result.success(true);
                    else if (text === 'false') return Result.success(false);
                }
            }

            return expected(value, error);
        },
        (value => value),
        false,
    );
};

export const numberField = <const Name extends string>(name: Name) => {
    const error = 'a number';

    return new RecordFieldBuilder(
        name,
        value => typeof value === 'number' && Number.isFinite(value) ? Result.success(value) : expected(value, error),
        value => {
            switch (typeof value) {
                case 'number':
                    if (isFinite(value)) return Result.success(value);
                    break;
                case 'string':
                    return parseNumber(value);
            }

            return expected(value, error);
        },
        value => value,
        false,
    );
};

export const integerField = <const Name extends string>(name: Name, unsafe: boolean = false) => {
    const error = getIntegerError(unsafe);

    const validator = getIntegerValidator(unsafe);

    return new RecordFieldBuilder(
        name,
        value => typeof value === 'number' && validator(value) ? Result.success(value) : expected(value, error),
        value => {
            switch (typeof value) {
                case 'number':
                    if (validator(value)) return Result.success(value); else break;
                case 'string':
                    return parseInteger(value, unsafe);
            }

            return expected(value, error);
        },
        value => value,
        false,
    );
};

export const bigintField = <const Name extends string>(name: Name) => {
    const error = 'a bigint';

    return new RecordFieldBuilder(
        name,
        value => typeof value === 'bigint' ? Result.success(value) : expected(value, error),
        value => {
            switch (typeof value) {
                case 'number':
                    if (Number.isInteger(value)) return Result.success(BigInt(value));
                    break;
                case 'string':
                    if (integerPattern.test(value.trim())) return Result.success(BigInt(value.trim().replaceAll(',', '')));
                    break;
            }

            return expected(value, error);
        },
        value => value == null ? value : value.toString(),
        false,
    );
};

export const stringField = <const Name extends string>(name: Name, match?: RegExp) => {
    const pattern = match
        ? new RegExp(match.source, match.flags.replace(/[gy]/g, ''))
        : undefined;

    const matcher = (value: unknown): value is string => typeof value === 'string' && (!pattern || pattern.test(value));

    const error = `a string${match ? ` matching ${match}` : ''}`;

    return new RecordFieldBuilder(
        name,
        value => matcher(value) ? Result.success(value) : expected(value, error),
        value => matcher(value) ? Result.success(value) : expected(value, error),
        value => value,
        false,
    );
};

/* Specialized Number Fields */
export const currencyField = <const Name extends string>(name: Name) => {
    const error = 'a currency';

    return new RecordFieldBuilder(
        name,
        value => typeof value === 'number' && Number.isFinite(value) ? Result.success(value) : expected(value, error),
        value => {
            switch (typeof value) {
                case 'number':
                    if (isFinite(value))
                        return Result.success(value);
                    break;
                case 'string': {
                    const text = value.trim();

                    const [_match, sign, numeric] = /^([+-]?)\$?([\d.,]+)$/.exec(text) ?? [];

                    const result = parseNumber(numeric ? `${sign}${numeric}` : text);

                    if (result.success)
                        return result;
                }
            }

            return expected(value, error);
        },
        value => value,
        false,
    );
};
export const percentField = <const Name extends string>(name: Name) => {
    const error = 'a percentage';

    return new RecordFieldBuilder(
        name,
        value => typeof value === 'number' && Number.isFinite(value) ? Result.success(value) : expected(value, error),
        value => {
            switch (typeof value) {
                case 'number':
                    if (isFinite(value))
                        return Result.success(value);
                    break;
                case 'string': {
                    const text = value.trim();

                    const [_match, numeric, percent] = /^([+-]?[\d.,]+)(%)?$/.exec(text) ?? [];

                    const result = parseNumber(percent ? numeric : text);

                    if (result.success)
                        return Result.success(percent ? result.value / 100 : result.value);
                }
            }

            return expected(value, error);
        },
        value => value,
        false,
    );
};

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
    const error = 'a phone number';

    if (typeof value !== 'string')
        return expected(value, error);

    const phone = getPhoneNumber(value, format);

    return phone ? Result.success(phone) : expected(value, error);
};

export const phoneField = <const Name extends string>(name: Name, format?: PhoneFormatter) => {
    const parser = phoneParser(format);

    return new RecordFieldBuilder(name, parser, parser, value => value, false);
};



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
    const storedkind = kind === 'zonedatetime' ? 'datetime' : kind;

    return new RecordFieldBuilder<Name, Date>(
        name,
        value => value instanceof Date && !isNaN(value.getTime())
            ? Result.success(value)
            : expected(value, 'a date'),
        value => {
            const parsed = parseTemporal(value, storedkind, zone ?? 'local');

            return parsed
                ? Result.success(parsed.toJSDate())
                : expected(value, `a ${storedkind}`);
        },
        value => {
            if (value == null)
                return value;

            // A JS Date is an instant. Use the requested zone when available; otherwise use the runtime's local timezone.
            const dt = DateTime.fromJSDate(value, { zone: zone ?? 'local' });

            return encodeTemporal(
                storedkind,
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

