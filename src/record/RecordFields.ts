import { DateTime } from 'luxon';

import { IsURLOptions } from 'validator';
import isEmail, { IsEmailOptions } from 'validator/lib/isEmail';
import isURL from 'validator/lib/isURL';
import { Result } from "../util";
import { isRecordTemporal, RecordDate, RecordFieldBuilder, RecordTemporalKind, RecordTemporalValue, RecordTime, RecordValue } from "./RecordSchema";


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
export type TemporalFormat =
    | 'iso'
    | (string & {});

export type TemporalParseOptions = {
    serial?: boolean;
    formats?: readonly TemporalFormat[];
    locale?: string;
};

const storedTemporalKind = (kind: RecordTemporalKind, zone?: string): RecordTemporalKind =>
    kind === 'zonedatetime' && zone !== undefined ? 'datetime' : kind;

const encodeTemporal = (value: DateTime, kind: RecordTemporalKind): RecordTemporalValue => {
    if (!value.isValid)
        throw new Error('Invalid DateTime');

    const { year, month, day, hour, minute, second, millisecond } = value;

    const date = { year, month, day };
    const time = { hour, minute, second, millisecond };

    switch (kind) {
        case 'date':
            return { kind, date };
        case 'time':
            return { kind, time };
        case 'datetime':
            return { kind, date, time };
        case 'zonedatetime':
            return {
                kind, date, time,
                zone: value.zone.type === 'fixed' && value.offset !== 0
                    ? value.toFormat('ZZ')
                    : value.zoneName ?? 'UTC'
            };
    }
};

const parseTemporal = (
    value: RecordValue,
    kind: RecordTemporalKind,
    defaultZone: string = 'UTC',
    options: TemporalParseOptions = {}
): DateTime | undefined => {

    // Strings
    if (typeof value === 'string') {
        const match = kind === 'zonedatetime'
            ? /^(.*)\[([^\[\]]+)\]$/.exec(value)
            : null;

        const text = match?.[1] ?? value;
        const zone = match?.[2] ?? defaultZone;
        const luxonZone = /^[+-]\d{2}:\d{2}$/.test(zone) ? `UTC${zone}` : zone;

        for (const format of options.formats ?? ['iso']) {
            const parsed =
                format === 'iso'
                    ? DateTime.fromISO(text, { zone: luxonZone })
                    : DateTime.fromFormat(text, format, {
                        zone: luxonZone,
                        locale: options.locale
                    });

            if (!parsed.isValid)
                continue;

            switch (kind) {
                case 'date':
                    return parsed.startOf('day');
                case 'time':
                    return parsed.set({ year: 1970, month: 1, day: 1 });
                default:
                    return parsed;
            }
        }

        return undefined;
    }

    // Spreadsheet serials
    if (typeof value === 'number') {
        if (!options.serial || !Number.isFinite(value))
            return undefined;

        const serial = new Date(
            Date.UTC(1899, 11, 30) + Math.round(value * 86400000)
        );

        if (isNaN(serial.getTime()))
            return undefined;

        const date = {
            year: serial.getUTCFullYear(),
            month: serial.getUTCMonth() + 1,
            day: serial.getUTCDate()
        };

        const time = {
            hour: serial.getUTCHours(),
            minute: serial.getUTCMinutes(),
            second: serial.getUTCSeconds(),
            millisecond: serial.getUTCMilliseconds()
        };

        switch (kind) {
            case 'date':
                value = { kind, date };
                break;
            case 'time':
                value = { kind, time };
                break;
            case 'datetime':
                value = { kind, date, time };
                break;
            case 'zonedatetime':
                value = { kind, date, time, zone: defaultZone };
                break;
        }
    }

    // Structured temporal values
    if (isRecordTemporal(value) && value.kind === kind) {
        const date = 'date' in value
            ? value.date
            : { year: 1970, month: 1, day: 1 };

        const time = 'time' in value
            ? value.time
            : { hour: 0 };

        const zone = value.kind === 'zonedatetime'
            ? value.zone
            : defaultZone;

        if (!date || !time || !zone)
            return undefined;

        const parts = {
            ...date,
            hour: time.hour,
            minute: time.minute ?? 0,
            second: time.second ?? 0,
            millisecond: time.millisecond ?? 0
        };

        const luxonZone = /^[+-]\d{2}:\d{2}$/.test(zone)
            ? `UTC${zone}`
            : zone;

        try {
            const parsed = DateTime.fromObject(parts, { zone: luxonZone });

            if (!parsed.isValid ||
                parsed.year !== parts.year ||
                parsed.month !== parts.month ||
                parsed.day !== parts.day ||
                parsed.hour !== parts.hour ||
                parsed.minute !== parts.minute ||
                parsed.second !== parts.second ||
                parsed.millisecond !== parts.millisecond)
                return undefined;

            return parsed;
        }
        catch {
            return undefined;
        }
    }

    return undefined;
};


/* JS Date */

// Unzoned
export function jsdateField<const Name extends string>(
    name: Name,
    kind: Exclude<RecordTemporalKind, 'zonedatetime'>,
    options?: TemporalParseOptions
): RecordFieldBuilder<Name, Date>;

// Zoned
export function jsdateField<const Name extends string>(
    name: Name,
    kind: 'zonedatetime',
    zone: string,
    options?: TemporalParseOptions
): RecordFieldBuilder<Name, Date>;

// Main FunctioN
export function jsdateField<const Name extends string>(
    name: Name,
    kind: RecordTemporalKind,
    zoneOrOptions?: string | TemporalParseOptions,
    options: TemporalParseOptions = {}
): RecordFieldBuilder<Name, Date> {
    const zone = typeof zoneOrOptions === 'string'
        ? zoneOrOptions
        : undefined;

    const parseOptions = typeof zoneOrOptions === 'string'
        ? options
        : zoneOrOptions ?? options;

    const storedKind = storedTemporalKind(kind, zone);

    const fieldZone = zone ?? 'local';

    return new RecordFieldBuilder<Name, Date>(
        name,
        value => value instanceof Date && !isNaN(value.getTime())
            ? Result.success(value)
            : expected(value, 'a date'),
        value => {
            const parsed = parseTemporal(value, storedKind, fieldZone, parseOptions);

            return parsed
                ? Result.success(parsed.toJSDate())
                : expected(value, `a ${storedKind}`);
        },
        value => value == null
            ? value
            : encodeTemporal(DateTime.fromJSDate(value, { zone: fieldZone }), storedKind),
        false
    );
}


/* Luxon DateTime */

// Unzoned
export function datetimeField<const Name extends string>(
    name: Name,
    kind: Exclude<RecordTemporalKind, 'zonedatetime'>,
    options?: TemporalParseOptions
): RecordFieldBuilder<Name, DateTime>;

// Dynamic Zoned
export function datetimeField<const Name extends string>(
    name: Name,
    kind: 'zonedatetime',
    options?: TemporalParseOptions
): RecordFieldBuilder<Name, DateTime>;

// Fixed Zoned
export function datetimeField<const Name extends string>(
    name: Name,
    kind: 'zonedatetime',
    zone: string,
    options?: TemporalParseOptions
): RecordFieldBuilder<Name, DateTime>;

// Main FunctioN
export function datetimeField<const Name extends string>(
    name: Name,
    kind: RecordTemporalKind,
    zoneOrOptions?: string | TemporalParseOptions,
    options: TemporalParseOptions = {}
): RecordFieldBuilder<Name, DateTime> {
    const zone = typeof zoneOrOptions === 'string'
        ? zoneOrOptions
        : undefined;

    const parseOptions = typeof zoneOrOptions === 'string'
        ? options
        : zoneOrOptions ?? options;

    const storedKind = storedTemporalKind(kind, zone);

    return new RecordFieldBuilder<Name, DateTime>(
        name,
        value => DateTime.isDateTime(value) && value.isValid
            ? Result.success(value)
            : expected(value, 'a valid DateTime'),
        value => {
            const parsed = parseTemporal(value, storedKind, zone, parseOptions);

            return parsed
                ? Result.success(parsed)
                : expected(value, `a ${storedKind}`);
        },
        value => value == null
            ? value
            : encodeTemporal(
                zone !== undefined ? value.setZone(zone) : value,
                storedKind
            ),
        false
    );
}