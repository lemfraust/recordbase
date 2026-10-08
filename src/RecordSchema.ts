import { Result } from "./Result";

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