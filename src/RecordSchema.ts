import { RecordField } from "./RecordField";
import { RecordGroup } from "./RecordGroup";

export type RecordElement =
    | RecordField<any, any, boolean>
    | RecordGroup<any, RecordField<any, any, boolean>[], any>;

export const RecordElement = Object.freeze({
    isGroup: (element: RecordElement): element is RecordGroup<any, any, any> =>
        'fields' in element,

    isField: (element: RecordElement): element is RecordField<any, any, any> =>
        !('fields' in element)
});

export type RecordSchema = RecordElement[];

