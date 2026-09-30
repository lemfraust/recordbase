import { RecordField } from "./RecordField";

export type RecordGroup<
    Name extends string,
    Fields extends RecordField<any, any, boolean>[],
    Optional extends boolean
> = {
    name: Name;
    isOptional: Optional;
    fields: Fields;
};