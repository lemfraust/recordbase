import { RecordElement, RecordField, RecordGroup, RecordSchema } from "./RecordSchema";
import { Simplify } from "./util";

export type RecordRef = string | number;

export type RecordGroupObject<Fields extends RecordField<any, any, boolean>[]> = Simplify<{
    [Item in Fields[number] as Item['isOptional'] extends false ? Item['name'] : never]:
        Item extends RecordField<any, infer Type, any>
            ? Type
            : never;
} & {
    [Item in Fields[number] as Item['isOptional'] extends true ? Item['name'] : never]?:
        Item extends RecordField<any, infer Type, any>
            ? Type | null
            : never;
}>;

export type RecordObject<Schema extends RecordSchema> = Simplify<{
    [Item in Schema[number] as Item['isOptional'] extends false ? Item['name'] : never]:
        Item extends RecordField<any, infer Type, any>
            ? Type
            : Item extends RecordGroup<any, infer Fields, any>
                ? RecordGroupObject<Fields>
                : never;
} & {
    [Item in Schema[number] as Item['isOptional'] extends true ? Item['name'] : never]?:
        Item extends RecordField<any, infer Type, any>
            ? Type | null
            : Item extends RecordGroup<any, infer Fields, any>
                ? RecordGroupObject<Fields> | null
                : never;
} & {
    readonly $ref?: RecordRef;
}>;


export type RecordGroupPatch<Fields extends RecordField<any, any, boolean>[]> = Simplify<{
    [Item in Fields[number] as Item['name']]?:
        Item extends RecordField<any, infer Type, infer Optional>
            ? Optional extends true ? Type | null : Type
            : never;
}>;

export type RecordPatch<Schema extends RecordSchema> = Simplify<{
    [Item in Schema[number] as Item['name']]?:
        Item extends RecordField<any, infer Type, infer Optional>
            ? Optional extends true ? Type | null : Type
            : Item extends RecordGroup<any, infer Fields, infer Optional>
                ? Optional extends true ? RecordGroupPatch<Fields> | null : RecordGroupPatch<Fields>
                : never;
} & {
    readonly $ref: RecordRef;
}>;


type RecordElementNames<Element extends RecordElement> =
    Element extends RecordField<infer Name>
        ? Name
        : Element extends RecordGroup<infer Name, infer Fields>
            ? Name | `${Name}.${Fields[number]['name']}`
            : never;

export type RecordNames<Schema extends RecordSchema> =
    RecordElementNames<Schema[number]>;