import { RecordData, RecordEntry, RecordGroupData, RecordGroupPartial, RecordPatch, RecordType } from "./RecordShapes";
import { freeze, Result } from "../util";

/* Value */
export type RecordDate = { year: number; month: number; day: number; };

export type RecordTime = { hour: number; minute?: number; second?: number; millisecond?: number; };

export type RecordTemporalValue =
    | { kind: 'date'; date: RecordDate; }
    | { kind: 'time'; time: RecordTime; }
    | { kind: 'datetime'; date: RecordDate; time: RecordTime; }
    | { kind: 'zonedatetime'; date: RecordDate; time: RecordTime; zone: string; };

export type RecordTemporalKind = RecordTemporalValue['kind'];

export type RecordValue = string | number | boolean | RecordTemporalValue | null | undefined;

export const isRecordTemporal = (value: RecordValue): value is RecordTemporalValue =>
    value !== null && typeof value === 'object' && 'kind' in value;

/* Processor */
export type RecordValidator<Type> = (value: unknown) => Result<Type, string>;

export type RecordParser<Type> = (value: string) => Result<Type, string>;

export type RecordEncoder<Type> = (value: Type | null | undefined) => RecordValue;


export type RecordProcessor<Type> = {
    validate: RecordValidator<Type>;
    parse: RecordParser<Type>;
    encode: RecordEncoder<Type>;
};

/* Schema */
export type RecordField<
    Name extends string = string,
    Type = any,
    Optional extends boolean = boolean,
> = {
    name: Name;
    isOptional: Optional;
} & RecordProcessor<Type>;

export type RecordGroup<
    Name extends string = string,
    Fields extends RecordField[] = RecordField[],
    Optional extends boolean = boolean,
> = {
    name: Name;
    fields: Fields;
    isOptional: Optional;
} & Iterable<Fields[number]>;

export interface RecordGroupDefinition<Fields extends RecordField<any, any, any>[]> extends Iterable<Fields[number]> {
    readonly fields: Readonly<Fields>;

    readonly type: RecordGroupData<Fields>;
    readonly patch: RecordGroupPartial<Fields>;

    validate(value: unknown): Result<RecordGroupData<Fields>, string>;
}

export type RecordElement = RecordField | RecordGroup;

export const RecordElement = Object.freeze({
    isGroup: (element: RecordElement): element is RecordGroup =>
        'fields' in element,

    isField: (element: RecordElement): element is RecordField =>
        !('fields' in element)
});

export type RecordSchema = RecordElement[];


// Validation
export function validateSchema<Schema extends RecordSchema>(schema: Schema, input: unknown): Result<RecordData<Schema>, string>;
export function validateSchema<Schema extends RecordSchema>(schema: Schema, input: unknown, allowRef: true): Result<RecordType<Schema>, string>;
export function validateSchema<Schema extends RecordSchema>(schema: Schema, input: unknown, allowRef = false)
    : Result<RecordData<Schema> | RecordType<Schema>, string> {

    if (input === null || typeof input !== 'object' || Array.isArray(input))
        return Result.failure('Expected an object');


    const record = input as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    const allowed = new Set<string>(schema.map(item => item.name));

    if (allowRef)
        allowed.add('$ref');

    // Reject unknown properties
    for (const name of Object.keys(record)) {
        if (!allowed.has(name))
            return Result.failure(`Unknown field: ${name}`);
    }

    for (const item of schema) {
        const value = record[item.name];

        // Required and optional fields
        if (value === null || value === undefined) {
            if (!item.isOptional)
                return Result.failure(`${item.name}: required`);

            if (value === null)
                output[item.name] = null;

            continue;
        }

        // Groups are validated recursively
        const result = 'fields' in item
            ? validateSchema(item.fields, value)
            : item.validate(value);

        if (!result.success)
            return Result.failure(`${item.name}: ${result.info}`);

        output[item.name] = result.value;
    }

    // Optional table reference
    if (allowRef && record.$ref !== undefined) {
        if (
            typeof record.$ref !== 'string' &&
            typeof record.$ref !== 'number'
        ) {
            return Result.failure(
                '$ref: expected a string or number'
            );
        }

        output.$ref = record.$ref;
    }

    return Result.success(output as RecordType<Schema>);
}

/* Builders */
export const typeOnly = (): never => { throw new Error('Type-only property cannot be accessed at runtime'); };

export class RecordFieldBuilder<
    const Name extends string,
    const Type,
    Optional extends boolean = false,
> implements RecordField<Name, Type, Optional> {
    constructor(
        public readonly name: Name,
        public readonly validate: RecordValidator<Type>,
        public readonly parse: RecordParser<Type>,
        public readonly encode: RecordEncoder<Type>,
        public readonly isOptional: Optional,
    ) { freeze(this); }

    get type(): Type {
        return typeOnly();
    }

    optional(): RecordFieldBuilder<Name, Type, true> {
        return new RecordFieldBuilder(
            this.name,
            this.validate,
            this.parse,
            this.encode,
            true,
        );
    }

    validator(validator: RecordValidator<Type>): RecordFieldBuilder<Name, Type, Optional> {
        return new RecordFieldBuilder(
            this.name,
            validator,
            this.parse,
            this.encode,
            this.isOptional,
        );
    }

    parser(parser: RecordParser<Type>): RecordFieldBuilder<Name, Type, Optional> {
        return new RecordFieldBuilder(
            this.name,
            this.validate,
            parser,
            this.encode,
            this.isOptional,
        );
    }

    encoder(encoder: RecordEncoder<Type>): RecordFieldBuilder<Name, Type, Optional> {
        return new RecordFieldBuilder(
            this.name,
            this.validate,
            this.parse,
            encoder,
            this.isOptional,
        );
    }

    as<NewName extends string>(name: NewName): RecordFieldBuilder<NewName, Type, Optional> {
        return new RecordFieldBuilder<NewName, Type, Optional>(
            name,
            this.validate,
            this.parse,
            this.encode,
            this.isOptional,
        );
    }
}

export class RecordGroupBuilder<
    const Name extends string,
    const Fields extends RecordField<any, any, any>[] = [],
    Optional extends boolean = false,
> implements RecordGroup<Name, Fields, Optional>, RecordGroupDefinition<Fields> {
    constructor(
        public readonly name: Name,
        public readonly fields: Fields,
        public readonly isOptional: Optional,
    ) {
        this.fields = freeze([...fields]) as unknown as Fields;
        freeze(this);
    }

    get type(): RecordGroupData<Fields> {
        return typeOnly();
    }


    get patch(): RecordGroupPartial<Fields> {
        return typeOnly();
    }

    optional(): RecordGroupBuilder<Name, Fields, true> {
        return new RecordGroupBuilder(this.name, this.fields, true);
    }

    as<NewName extends string>(name: NewName): RecordGroupBuilder<NewName, Fields, Optional> {
        return new RecordGroupBuilder<NewName, Fields, Optional>(name, this.fields, this.isOptional);
    }

    validate(value: unknown): Result<RecordGroupData<Fields>, string> {
        return validateSchema(this.fields, value);
    }

    [Symbol.iterator]() {
        return this.fields[Symbol.iterator]();
    }
}

export type RecordGroupFactory<Fields extends RecordField<any, any, any>[]> =
    (<const Name extends string>(name: Name) => RecordGroupBuilder<Name, Fields, false>)
    & RecordGroupDefinition<Fields>;

export class RecordTable<
    const Name extends string = string,
    const Schema extends RecordSchema = RecordSchema
> implements Iterable<Schema[number]> {
    constructor(
        public readonly name: Name,
        public readonly schema: Schema
    ) { freeze(this); }


    // Type Helpers
    get type(): RecordType<Schema> {
        return typeOnly();
    }

    get data(): RecordData<Schema> {
        return typeOnly();
    }

    get entry(): RecordEntry<Schema> {
        return typeOnly();
    }

    get patch(): RecordPatch<Schema> {
        return typeOnly();
    }


    as<NewName extends string>(name: NewName): RecordTable<NewName, Schema> {
        return new RecordTable(name, this.schema);
    }

    validate(value: unknown): Result<RecordType<Schema>, string> {
        return validateSchema(this.schema, value, true);
    }

    [Symbol.iterator]() {
        return this.schema[Symbol.iterator]();
    }
}

export type RecordTableSchema<Table extends RecordTable> = Table['schema'];

export type RecordTableType<Table extends RecordTable> = RecordType<Table['schema']>;

export type RecordTableData<Table extends RecordTable> = RecordData<Table['schema']>;

export type RecordTableEntry<Table extends RecordTable> = RecordEntry<Table['schema']>;

export type RecordTablePatch<Table extends RecordTable> = RecordPatch<Table['schema']>;