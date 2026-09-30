import { RecordField } from "./RecordField";
import { RecordGroup } from "./RecordGroup";
import { RecordSchema } from "./RecordSchema";

export type RecordId = string | number;

export type Simplify<T> = { [K in keyof T]: T[K] };

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
    $id?: RecordId;
}>;

type _RecordNames<Schema extends RecordSchema> = {
    [Item in Schema[number] as Item['name']]:
        Item extends RecordField<any, any, any>
            ? Item['name']
            : Item extends RecordGroup<any, infer Fields, any>
                ? Item['name'] | `${Item['name']}.${_RecordNames<Fields>[keyof _RecordNames<Fields>]}`
                : never;
};

export type RecordNames<Schema extends RecordSchema> = _RecordNames<Schema>[keyof _RecordNames<Schema>];