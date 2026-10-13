import { RecordGroupData } from "./RecordShapes";
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
    Optional extends boolean = boolean
> = {
    name: Name;
    isOptional: Optional;
} & RecordProcessor<Type>;

export type RecordGroup<
    Name extends string = string,
    Fields extends RecordField[] = RecordField[],
    Optional extends boolean = boolean
> = {
    name: Name;
    isOptional: Optional;
    fields: Fields;
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
export class RecordFieldBuilder<
    const Name extends string,
    const Type,
    Optional extends boolean = false
> implements RecordField<Name, Type, Optional> {
    constructor(
        public readonly name: Name,
        public readonly isOptional: Optional,
        public readonly validate: RecordValidator<Type>,
        public readonly parse: RecordParser<Type>,
        public readonly encode: RecordEncoder<Type>
    ) { freeze(this); }

    optional(): RecordFieldBuilder<Name, Type, true> {
        return new RecordFieldBuilder(
            this.name,
            true,
            this.validate,
            this.parse,
            this.encode,
        );
    }

    validator(validator: RecordValidator<Type>): RecordFieldBuilder<Name, Type, Optional> {
        return new RecordFieldBuilder(
            this.name,
            this.isOptional,
            validator,
            this.parse,
            this.encode,
        );
    }

    parser(parser: RecordParser<Type>): RecordFieldBuilder<Name, Type, Optional> {
        return new RecordFieldBuilder(
            this.name,
            this.isOptional,
            this.validate,
            parser,
            this.encode,
        );
    }

    encoder(encoder: RecordEncoder<Type>): RecordFieldBuilder<Name, Type, Optional> {
        return new RecordFieldBuilder(
            this.name,
            this.isOptional,
            this.validate,
            this.parse,
            encoder,
        );
    }
}

export class RecordGroupBuilder<
    const Name extends string,
    const Fields extends RecordField<any, any, any>[],
    Optional extends boolean = false
> implements RecordGroup<Name, Fields, Optional> {
    constructor(
        public readonly name: Name,
        public readonly isOptional: Optional,
        public readonly fields: Fields
    ) {
        this.fields = freeze([...fields]) as unknown as Fields;
        freeze(this);
    }

    get type(): RecordGroupData<Fields> {
        throw new Error('This is a type helper and should not be used at runtime');
    }

    optional(): RecordGroupBuilder<Name, Fields, true> {
        return new RecordGroupBuilder(this.name, true, this.fields);
    }
}