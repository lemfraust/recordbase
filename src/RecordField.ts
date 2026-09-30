import { RecordProcessor } from "./RecordProcessor";

export type RecordField<Name extends string, Type, Optional extends boolean> = {
    name: Name;
    isOptional: Optional;
} & RecordProcessor<Type>;