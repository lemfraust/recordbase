import { describe, expect, it } from 'vitest';
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