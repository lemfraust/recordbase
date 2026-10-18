import { RecordData, RecordEntry, RecordGroupData, RecordGroupPartial, RecordPatch, RecordType } from "./RecordShapes";
import { freeze, Result } from "../util";

/* Value */
export type RecordValue = string | number | boolean | Date | { formula: string; } | null | undefined;

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
};

export type RecordElement = RecordField | RecordGroup;

export const RecordElement = Object.freeze({
    isGroup: (element: RecordElement): element is RecordGroup =>
        'fields' in element,

    isField: (element: RecordElement): element is RecordField =>
        !('fields' in element)
});

export type RecordSchema = RecordElement[];


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
> implements RecordGroup<Name, Fields, Optional> {
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
}

export type RecordGroupFactory<
    Fields extends RecordField<any, any, any>[]
> = (<const Name extends string>(
    name: Name
) => RecordGroupBuilder<Name, Fields, false>) & Iterable<Fields[number]> & {
    readonly fields: Readonly<Fields>;
    readonly type: RecordGroupData<Fields>;
    readonly patch: RecordGroupPartial<Fields>;
};

export class RecordTable<
    const Name extends string = string,
    const Schema extends RecordSchema = RecordSchema
> {
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
}

export type RecordTableSchema<Table extends RecordTable> = Table['schema'];

export type RecordTableType<Table extends RecordTable> = RecordType<Table['schema']>;

export type RecordTableData<Table extends RecordTable> = RecordData<Table['schema']>;

export type RecordTableEntry<Table extends RecordTable> = RecordEntry<Table['schema']>;

export type RecordTablePatch<Table extends RecordTable> = RecordPatch<Table['schema']>;