import { RecordGroupObject } from "./RecordObject";
import { RecordEncoder, RecordField, RecordGroup, RecordParser, RecordValidator } from "./RecordSchema";

export class RecordFieldBuilder<
    const Name extends string,
    const Type,
    Optional extends boolean = false
> implements RecordField<Name, Type, Optional> {
    constructor(
        public readonly name: Name,
        public readonly isOptional: Optional,
        public readonly validate: RecordValidator<Type>,
        public readonly parse: RecordParser<Type>,
        public readonly encode: RecordEncoder<Type>
    ) { }

    optional(): RecordFieldBuilder<Name, Type, true> {
        return new RecordFieldBuilder(
            this.name,
            true,
            this.validate,
            this.parse,
            this.encode,
        );
    }

    validator(validator: RecordValidator<Type>): RecordFieldBuilder<Name, Type, Optional> {
        return new RecordFieldBuilder(
            this.name,
            this.isOptional,
            validator,
            this.parse,
            this.encode,
        );
    }

    parser(parser: RecordParser<Type>): RecordFieldBuilder<Name, Type, Optional> {
        return new RecordFieldBuilder(
            this.name,
            this.isOptional,
            this.validate,
            parser,
            this.encode,
        );
    }

    encoder(encoder: RecordEncoder<Type>): RecordFieldBuilder<Name, Type, Optional> {
        return new RecordFieldBuilder(
            this.name,
            this.isOptional,
            this.validate,
            this.parse,
            encoder,
        );
    }
}

export class RecordGroupBuilder<
    const Name extends string,
    const Fields extends RecordField<any, any, any>[],
    Optional extends boolean = false
> implements RecordGroup<Name, Fields, Optional> {
    constructor(
        public readonly name: Name,
        public readonly isOptional: Optional,
        public readonly fields: Fields
    ) { }

    get type(): RecordGroupObject<Fields> {
        throw new Error('This is a type helper and should not be used at runtime');
    }

    optional(): RecordGroupBuilder<Name, Fields, true> {
        return new RecordGroupBuilder(this.name, true, this.fields);
    }
}