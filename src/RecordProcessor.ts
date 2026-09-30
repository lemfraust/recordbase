import { RecordValue } from "./RecordValue";
import { Result } from "./Result";

export type RecordValidator<Type> = (value: any) => Result<Type, string>;

export type RecordParser<Type> = (value: string) => Result<Type, string>;

export type RecordEncoder<Type> = (value: Type | null | undefined) => RecordValue;

export type RecordProcessor<Type> = {
    validate: RecordValidator<Type>;
    parse: RecordParser<Type>;
    encode: RecordEncoder<Type>;
};