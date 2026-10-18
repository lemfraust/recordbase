import { RecordElement, RecordField, RecordGroup, RecordSchema } from "./RecordSchema";
import { Simplify } from "../util";


export type RecordRef = string | number;


/* Data */
type RecordDataValue<Item extends RecordElement> =
    Item extends RecordField<any, infer Type, any>
        ? Type
        : Item extends { fields: infer Fields extends RecordField[] }
            ? { [Key in keyof RecordGroupData<Fields>]: RecordGroupData<Fields>[Key]; }
            : never;

type RecordDataShape<Elements extends readonly RecordElement[]> = {
    [Item in Elements[number] as Item['isOptional'] extends false ? Item['name'] : never]:
        RecordDataValue<Item>;
} & {
    [Item in Elements[number] as Item['isOptional'] extends true ? Item['name'] : never]?:
        RecordDataValue<Item> | null;
};

export type RecordGroupData<Fields extends RecordField<any, any, boolean>[]> =
    Simplify<RecordDataShape<Fields>>;

export type RecordData<Schema extends RecordSchema> =
    Simplify<RecordDataShape<Schema>>;


/* Partial */
type RecordPartialValue<Item extends RecordElement> =
    Item extends { fields: infer Fields extends RecordField[]; isOptional: infer Optional extends boolean; }
        ? { [Key in keyof RecordGroupPartial<Fields>]: RecordGroupPartial<Fields>[Key]; } | (Optional extends true ? null : never)
        : Item extends RecordField<any, infer Type, infer Optional>
            ? Type | (Optional extends true ? null : never)
            : never;

type RecordPartialShape<Elements extends readonly RecordElement[]> = {
    [Item in Elements[number] as Item['name']]?:
        RecordPartialValue<Item> | undefined;
};

export type RecordGroupPartial<Fields extends RecordField<any, any, boolean>[]> =
    Simplify<RecordPartialShape<Fields>>;

export type RecordPartial<Schema extends RecordSchema> =
    Simplify<RecordPartialShape<Schema>>;


/* Stored */
export type RecordType<Schema extends RecordSchema> = Simplify<
    RecordDataShape<Schema> & {
        readonly $ref?: RecordRef;
    }
>;

export type RecordEntry<Schema extends RecordSchema> = Simplify<
    RecordDataShape<Schema> & {
        readonly $ref: RecordRef;
    }
>;

export type RecordPatch<Schema extends RecordSchema> = Simplify<
    RecordPartialShape<Schema> & {
        readonly $ref: RecordRef;
    }
>;


/* Names */
type RecordElementNames<Item extends RecordElement> =
    Item extends RecordField<infer Name, any, any>
        ? Name
        : Item extends RecordGroup<infer Name, infer Fields, any>
            ? Name | `${Name}.${Fields[number]['name']}`
            : never;

export type RecordNames<Schema extends RecordSchema> =
    RecordElementNames<Schema[number]>;