import { describe, expect, expectTypeOf, it } from 'vitest';
import { rb } from '../src';

describe('RecordBase', () => {

    it('creates a table with typed fields', () => {
        const users = rb.table('Users', [
            rb.string('name'),
            rb.number('age'),
            rb.boolean('active')
        ]);

        expect(users.name).toBe('Users');

        expect(users.schema.map(field => field.name)).toEqual([
            'name',
            'age',
            'active'
        ]);
    });

    it('checks grid helpers', () => {
        expect(rb.grid.google).toBeTypeOf('function');
        expect(rb.grid.store).toBeTypeOf('function');
    });

});


const Phone = rb.phone('Phone');
const Email = rb.email('Email').optional();
const Age = rb.integer('Age');

const ContactInfo = rb.group([Phone, Email, Age]);

type ContactData = {
    Phone: string;
    Email?: string | null;
    Age: number;
};

describe('Group Schema Reuse', () => {

    it('exposes fields and supports iteration', () => {
        expect(ContactInfo.fields.map(f => f.name)).toEqual([
            'Phone', 'Email', 'Age'
        ]);

        expect([...ContactInfo]).toEqual(ContactInfo.fields);

        expectTypeOf<typeof ContactInfo.type>().toEqualTypeOf<ContactData>();
    });

    it('uses a group directly as a table schema', () => {
        const Contacts = rb.table('Contacts', ContactInfo);

        expect(Contacts.schema.map(f => f.name)).toEqual([
            'Phone', 'Email', 'Age'
        ]);

        expectTypeOf<typeof Contacts.type>().toEqualTypeOf<ContactData>();
    });

    it('spreads group fields inline', () => {
        const People = rb.table('People', [
            rb.string('Name'),
            ...ContactInfo
        ]);

        expect(People.schema.map(f => f.name)).toEqual([
            'Name', 'Phone', 'Email', 'Age'
        ]);

        expectTypeOf<typeof People.type>().toEqualTypeOf<{
            Name: string;
            Phone: string;
            Email?: string | null;
            Age: number;
        }>();
    });

    it('supports nested named groups', () => {
        const Requests = rb.table('Requests', [
            rb.string('Name'),
            ContactInfo('Contact')
        ]);

        expect(Requests.schema.map(f => f.name)).toEqual([
            'Name', 'Contact'
        ]);

        expectTypeOf<typeof Requests.type>().toEqualTypeOf<{
            Name: string;
            Contact: ContactData;
        }>();
    });

    it('supports renaming fields and groups', () => {
        const Customers = rb.table('Customers', [
            Phone.as('Mobile'),
            ContactInfo('Billing').as('Primary')
        ]);

        expect(Customers.schema.map(f => f.name)).toEqual([
            'Mobile', 'Primary'
        ]);

        expectTypeOf<typeof Customers.type>().toEqualTypeOf<{
            Mobile: string;
            Primary: ContactData;
        }>();
    });

    it('infers group and table patches', () => {
        const Requests = rb.table('Requests', [
            rb.string('Name'),
            ContactInfo('Contact')
        ]);

        expectTypeOf<typeof ContactInfo.patch>().toEqualTypeOf<{
            Phone?: string;
            Email?: string | null;
            Age?: number;
        }>();

        expectTypeOf<typeof Requests.patch>().toEqualTypeOf<{
            readonly $ref: string | number;
            Name?: string;
            Contact?: {
                Phone?: string;
                Email?: string | null;
                Age?: number;
            };
        }>();

        const patch: typeof Requests.patch = {
            $ref: 1,
            Contact: { Age: 30 }
        };

        expect(patch.Contact?.Age).toBe(30);
    });

});