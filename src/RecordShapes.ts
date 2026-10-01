import { RecordField } from "./RecordField";
import { RecordGroup } from "./RecordGroup";
import { RecordSchema } from "./RecordSchema";

export type Simplify<Type> = { [Key in keyof Type]: Type[Key] };

export type RecordId = string | number;


export type RecordGroupData<Fields extends RecordField<any, any, boolean>[]> = Simplify<{
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

export type RecordData<Schema extends RecordSchema> = Simplify<{
    [Item in Schema[number] as Item['isOptional'] extends false ? Item['name'] : never]:
        Item extends RecordField<any, infer Type, any>
            ? Type
            : Item extends RecordGroup<any, infer Fields, any>
                ? RecordGroupData<Fields>
                : never;
} & {
    [Item in Schema[number] as Item['isOptional'] extends true ? Item['name'] : never]?:
        Item extends RecordField<any, infer Type, any>
            ? Type | null
            : Item extends RecordGroup<any, infer Fields, any>
                ? RecordGroupData<Fields> | null
                : never;
}>;


export type RecordGroupPartial<Fields extends RecordField<any, any, boolean>[]> = Simplify<{
    [Item in Fields[number] as Item['name']]?:
        Item extends RecordField<any, infer Type, infer Optional>
            ? Optional extends true ? Type | null : Type
            : never;
}>;

export type RecordPartial<Schema extends RecordSchema> = Simplify<{
    [Item in Schema[number] as Item['name']]?:
        Item extends RecordField<any, infer Type, infer Optional>
            ? Optional extends true ? Type | null : Type
            : Item extends RecordGroup<any, infer Fields, infer Optional>
                ? Optional extends true ? RecordGroupPartial<Fields> | null : RecordGroupPartial<Fields>
                : never;
}>;


export type RecordEntry<Schema extends RecordSchema> = Simplify<
    RecordData<Schema> & {
        readonly $id: RecordId;
    }
>;

export type RecordPatch<Schema extends RecordSchema> = Simplify<
    RecordPartial<Schema> & {
        readonly $id: RecordId;
    }
>;


type _RecordNames<Schema extends RecordSchema> = {
    [Item in Schema[number] as Item['name']]:
        Item extends RecordField<any, any, any>
            ? Item['name']
            : Item extends RecordGroup<any, infer Fields, any>
                ? Item['name'] | `${Item['name']}.${_RecordNames<Fields>[keyof _RecordNames<Fields>]}`
                : never;
};

export type RecordNames<Schema extends RecordSchema> =
    _RecordNames<Schema>[keyof _RecordNames<Schema>];