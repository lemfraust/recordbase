import { RecordObject } from "./RecordObject";
import { RecordSchema } from "./RecordSchema";

export class RecordTable<
    const Name extends string,
    const Schema extends RecordSchema
> {
    constructor(
        public readonly name: Name,
        public readonly schema: Schema
    ) { }

    get type(): RecordObject<Schema> {
        throw new Error('This is a type helper and should not be used at runtime');
    }
}