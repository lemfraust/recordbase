import { describe, expect, expectTypeOf, it } from 'vitest';
import { rb, RecordBook } from '../src';

const Phone = rb.string('Phone');
const Email = rb.string('Email').optional();
const Status = rb.enum('Status', ['Open', 'Closed']);

const Contact = rb.group([Phone, Email]);
const Billing = Contact('Billing');

const Contacts = rb.table('Contacts', Contact);
const Flat = rb.table('Flat', [rb.string('Name'), ...Contact]);
const People = rb.table('People', [
    rb.string('Name'),
    Contact('Contact'),
    Status.optional()
]);

type ContactData = {
    Phone: string;
    Email?: string | null;
};

type ContactPatch = {
    Phone?: string;
    Email?: string | null;
};

type PersonData = {
    Name: string;
    Contact: ContactData;
    Status?: 'Open' | 'Closed' | null;
};

type PersonType = {
    readonly $ref?: string | number;
    Name: string;
    Contact: ContactData;
    Status?: 'Open' | 'Closed' | null;
};

type PersonEntry = {
    readonly $ref: string | number;
    Name: string;
    Contact: ContactData;
    Status?: 'Open' | 'Closed' | null;
};

type PersonPatch = {
    readonly $ref: string | number;
    Name?: string;
    Contact?: ContactPatch;
    Status?: 'Open' | 'Closed' | null;
};

describe('fields', () => {
    it('preserves names and optionality', () => {
        expect(Phone.name).toBe('Phone');
        expect(Phone.isOptional).toBe(false);
        expect(Email.name).toBe('Email');
        expect(Email.isOptional).toBe(true);
    });

    it('returns new fields when renamed or made optional', () => {
        const renamed = Phone.as('Mobile');
        const optional = Phone.optional();

        expect(renamed.name).toBe('Mobile');
        expect(optional.isOptional).toBe(true);
        expect(Phone.name).toBe('Phone');
        expect(Phone.isOptional).toBe(false);
    });

    it('uses custom validators without mutating the original field', () => {
        const NonEmpty = Phone.validator(value =>
            typeof value === 'string' && value.trim().length > 0
                ? { success: true, value: value.trim() }
                : { success: false, info: 'Required text' }
        );

        expect(NonEmpty.validate(' 123 ')).toEqual({ success: true, value: '123' });
        expect(NonEmpty.validate('')).toEqual({ success: false, info: 'Required text' });
        expect(Phone.validate('')).toEqual({ success: true, value: '' });
    });

    it('supports custom parsers and encoders', () => {
        const Tagged = rb.string('Tag')
            .parser(value => ({ success: true, value: value.toUpperCase() }))
            .encoder(value => value?.toLowerCase() ?? null);

        expect(Tagged.parse('abc')).toEqual({ success: true, value: 'ABC' });
        expect(Tagged.encode('ABC')).toBe('abc');
    });

    it('preserves enum literal types', () => {
        expect(Status.validate('Open').success).toBe(true);
        expect(Status.validate('Unknown').success).toBe(false);
        expectTypeOf<typeof Status.type>().toEqualTypeOf<'Open' | 'Closed'>();
    });
});

describe('groups', () => {
    it('creates an unnamed, callable, iterable group', () => {
        expect(typeof Contact).toBe('function');
        expect(Contact.fields.map(field => field.name)).toEqual(['Phone', 'Email']);
        expect([...Contact]).toEqual(Contact.fields);
        expect(Object.isFrozen(Contact.fields)).toBe(true);
    });

    it('creates named groups and preserves their fields', () => {
        expect(Billing.name).toBe('Billing');
        expect([...Billing]).toEqual(Contact.fields);
        expect(Object.isFrozen(Billing.fields)).toBe(true);
        expect(Contact('Shipping').name).toBe('Shipping');
    });

    it('supports immediately named groups', () => {
        const Named = rb.group('Details', [Phone, Email]);
        expect(Named.name).toBe('Details');
        expect([...Named].map(field => field.name)).toEqual(['Phone', 'Email']);
        expect(Named.validate({ Phone: '123' }).success).toBe(true);
    });

    it('renames named groups and changes optionality immutably', () => {
        const renamed = Billing.as('Shipping');
        const optional = Billing.optional();

        expect(renamed.name).toBe('Shipping');
        expect(optional.isOptional).toBe(true);
        expect(Billing.name).toBe('Billing');
        expect(Billing.isOptional).toBe(false);
        expectTypeOf<typeof renamed.name>().toEqualTypeOf<'Shipping'>();
    });

    it('validates unnamed and named groups', () => {
        const data = { Phone: '123', Email: null };
        const expected = { success: true, value: data };

        expect(Contact.validate(data)).toEqual(expected);
        expect(Billing.validate(data)).toEqual(expected);
    });

    it('accepts absent optional fields', () => {
        expect(Contact.validate({ Phone: '123' })).toEqual({
            success: true,
            value: { Phone: '123' }
        });
    });

    it('rejects missing, null, and incorrectly typed required fields', () => {
        expect(Contact.validate({}).success).toBe(false);
        expect(Contact.validate({ Phone: null }).success).toBe(false);
        expect(Contact.validate({ Phone: 123 }).success).toBe(false);
    });

    it('rejects unknown fields', () => {
        expect(Contact.validate({ Phone: '123', Extra: true }).success).toBe(false);
    });

    it('returns normalized values from field validators', () => {
        const Trimmed = rb.group([
            rb.string('Code').validator(value =>
                typeof value === 'string'
                    ? { success: true, value: value.trim() }
                    : { success: false, info: 'Expected string' }
            )
        ]);

        expect(Trimmed.validate({ Code: ' AB ' })).toEqual({
            success: true,
            value: { Code: 'AB' }
        });
    });
});

describe('tables', () => {
    it('accepts an unnamed group as the entire schema', () => {
        expect(Contacts.schema.map(field => field.name)).toEqual(['Phone', 'Email']);
    });

    it('flattens spread group fields', () => {
        expect(Flat.schema.map(field => field.name)).toEqual(['Name', 'Phone', 'Email']);
    });

    it('keeps named groups nested', () => {
        expect(People.schema.map(item => item.name)).toEqual(['Name', 'Contact', 'Status']);
    });

    it('is iterable', () => {
        expect([...People].map(item => item.name)).toEqual(['Name', 'Contact', 'Status']);
    });

    it('renames without changing the original table', () => {
        const renamed = People.as('Customers');
        expect(renamed.name).toBe('Customers');
        expect(People.name).toBe('People');
        expect(renamed.schema).toBe(People.schema);
        expectTypeOf<typeof renamed.name>().toEqualTypeOf<'Customers'>();
    });

    it('validates table data with or without $ref', () => {
        const data = { Name: 'John', Contact: { Phone: '123' } };

        expect(People.validate(data)).toEqual({ success: true, value: data });
        expect(People.validate({ ...data, $ref: 42 })).toEqual({
            success: true,
            value: { ...data, $ref: 42 }
        });
    });

    it('validates optional nested groups', () => {
        const Optional = rb.table('Optional', [Contact('Contact').optional()]);
        expect(Optional.validate({}).success).toBe(true);
        expect(Optional.validate({ Contact: null }).success).toBe(true);
        expect(Optional.validate({ Contact: { Phone: '123' } }).success).toBe(true);
    });

    it('rejects invalid nested values', () => {
        expect(People.validate({ Name: 'John', Contact: { Phone: 123 } }).success)
            .toBe(false);
        expect(People.validate({ Name: 'John' }).success).toBe(false);
    });

    it('rejects invalid $ref and extra properties', () => {
        const data = { Name: 'John', Contact: { Phone: '123' } };
        expect(People.validate({ ...data, $ref: true }).success).toBe(false);
        expect(People.validate({ ...data, Extra: 1 }).success).toBe(false);
        expect(People.validate({ ...data, Contact: { Phone: '123', Extra: 1 } }).success)
            .toBe(false);
    });

    it('does not evaluate type-only getters at runtime', () => {
        expect(() => People.type).toThrow();
        expect(() => People.data).toThrow();
        expect(() => People.entry).toThrow();
        expect(() => People.patch).toThrow();
        expect(() => Contact.type).toThrow();
        expect(() => Contact.patch).toThrow();
    });
});

describe('type inference (run tsc --noEmit too)', () => {
    it('keeps group values and patches precise', () => {
        expectTypeOf<typeof Phone.type>().toEqualTypeOf<string>();
        expectTypeOf<typeof Contact.type>().toEqualTypeOf<ContactData>();
        expectTypeOf<typeof Billing.type>().toEqualTypeOf<ContactData>();
        expectTypeOf<typeof Contact.patch>().toEqualTypeOf<ContactPatch>();
        expectTypeOf<typeof Billing.patch>().toEqualTypeOf<ContactPatch>();
    });

    it('infers direct and spread group schemas', () => {
        expectTypeOf<typeof Contacts.data>().toEqualTypeOf<ContactData>();
        expectTypeOf<typeof Flat.data>().toEqualTypeOf<{
            Name: string;
            Phone: string;
            Email?: string | null;
        }>();
    });

    it('infers all four table representations', () => {
        type ptype = typeof People.type;
        type pentry = typeof People.entry;
        type pdata = typeof People.data;
        type ppatch = typeof People.patch;

        expectTypeOf<ptype>().toEqualTypeOf<PersonType>();
        expectTypeOf<pentry>().toEqualTypeOf<PersonEntry>();
        expectTypeOf<pdata>().toEqualTypeOf<PersonData>();
        expectTypeOf<ppatch>().toEqualTypeOf<PersonPatch>();
    });

    it('accepts valid data, entries, general records, and patches', () => {
        const data: typeof People.data = {
            Name: 'John', Contact: { Phone: '123' }, Status: 'Open'
        };
        const entry: typeof People.entry = { ...data, $ref: 10 };
        const record: typeof People.type = data;
        const patch: typeof People.patch = { $ref: 10, Contact: { Email: null } };

        expect(record.Name).toBe('John');
        expect(entry.$ref).toBe(10);
        expect(patch.Contact?.Email).toBeNull();
    });

    it('rejects invalid assignments at compile time', () => {
        if (false) {
            // @ts-expect-error Required nested field is missing
            const missingPhone: typeof People.data = { Name: 'John', Contact: {} };
            // @ts-expect-error Enum value must be in the declared union
            const wrongStatus: typeof Status.type = 'Unknown';
            // @ts-expect-error A patch requires $ref
            const missingRef: typeof People.patch = { Name: 'John' };
            // @ts-expect-error $ref is not a boolean
            const wrongRef: typeof People.type = { $ref: true, Name: 'John', Contact: { Phone: '123' } };
            // @ts-expect-error An unnamed group cannot be a nested schema element
            const invalidTable = rb.table('Invalid', [Contact]);

            void [missingPhone, wrongStatus, missingRef, wrongRef, invalidTable];
        }
    });
});
