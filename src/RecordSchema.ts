import { Result } from "./Result";

/* Value */
export type RecordValue = | string | number | boolean | Date | { formula: string; } | null | undefined;

/* Processor */
export type RecordValidator<Type> = (value: any) => Result<Type, string>;
export type RecordParser<Type> = (value: string) => Result<Type, string>;
export type RecordEncoder<Type> = (value: Type | null | undefined) => RecordValue;

export type RecordProcessor<Type> = {
    validate: RecordValidator<Type>;
    parse: RecordParser<Type>;
    encode: RecordEncoder<Type>;
};


/* Schema */
export type RecordField<Name extends string, Type, Optional extends boolean> = {
    name: Name;
    isOptional: Optional;
} & RecordProcessor<Type>;

export type RecordGroup<
    Name extends string,
    Fields extends RecordField<any, any, boolean>[],
    Optional extends boolean
> = {
    name: Name;
    isOptional: Optional;
    fields: Fields;
};

export type RecordElement =
    | RecordField<any, any, boolean>
    | RecordGroup<any, RecordField<any, any, boolean>[], boolean>;

export const RecordElement = Object.freeze({
    isGroup: (element: RecordElement): element is RecordGroup<any, any, any> =>
        'fields' in element,

    isField: (element: RecordElement): element is RecordField<any, any, any> =>
        !('fields' in element)
});

export type RecordSchema = RecordElement[];
