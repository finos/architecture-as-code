import { describe, it, expect } from 'vitest';
import { TableWidget } from './index';

describe('TableWidget', () => {
    describe('validateContext', () => {
        it('accepts array of objects', () => {
            expect(TableWidget.validateContext([{ a: 1 }, { b: 2 }])).toBe(true);
        });

        it('accepts single object', () => {
            expect(TableWidget.validateContext({ foo: { bar: 1 }, baz: { qux: 2 } })).toBe(true);
        });

        it('rejects null and invalid types', () => {
            expect(TableWidget.validateContext(null)).toBe(false);
            expect(TableWidget.validateContext(123)).toBe(false);
            expect(TableWidget.validateContext('string')).toBe(false);
        });

        it('rejects arrays of non-objects', () => {
            expect(TableWidget.validateContext([1, 2, 3])).toBe(false);
        });

        it('rejects array with null elements', () => {
            expect(TableWidget.validateContext([{ a: 1 }, null])).toBe(false);
        });
    });

    describe('transformToViewModel (array context)', () => {
        const data = [
            { 'unique-id': '1', name: 'Alice' },
            { 'unique-id': '2', name: 'Bob', extra: undefined },
            { 'unique-id': '', name: 'Empty ID' },
            { name: 'No ID' },
            { 'unique-id': null },
        ];

        it('transforms array with default options', () => {
            const vm = TableWidget.transformToViewModel!(data, {});
            expect(vm.headers).toBe(true);
            expect(vm.flatTable).toBe(false);
            expect(vm.rows.length).toBe(5);
            expect(vm.rows[0]).toEqual({ id: '1', data: { 'unique-id': '1', name: 'Alice' } });
            expect(vm.rows[1]).toEqual({ id: '2', data: { 'unique-id': '2', name: 'Bob' } });
            expect(vm.rows[2]).toEqual({ id: '2', data: { 'unique-id': '', name: 'Empty ID' } });
            expect(vm.rows[3]).toEqual({ id: '3', data: { name: 'No ID' } });
            expect(vm.rows[4]).toEqual({ id: '4', data: { 'unique-id': null } });
        });

        it('trims whitespace id and falls back to index', () => {
            const vm = TableWidget.transformToViewModel!([{ 'unique-id': '   ', name: 'X' }], {});
            expect(vm.rows[0]).toEqual({ id: '0', data: { 'unique-id': '   ', name: 'X' } });
        });

        it('respects headers option = false', () => {
            const vm = TableWidget.transformToViewModel!(data, { headers: false });
            expect(vm.headers).toBe(false);
        });

        it('filters columns correctly and sets flatTable', () => {
            const vm = TableWidget.transformToViewModel!(data, { columns: 'name' });
            expect(vm.flatTable).toBe(true);
            expect(vm.columnNames).toEqual(['name']);
            expect(vm.rows[0]).toEqual({ id: '1', data: { name: 'Alice' } });
        });

        it('filters columns and keeps key out of data', () => {
            const vm = TableWidget.transformToViewModel!(data, { columns: 'name', key: 'unique-id' });
            expect(vm.rows[0]).toEqual({ id: '1', data: { name: 'Alice' } });
        });

        it('injects unique-id into data when requested in columns', () => {
            const vm = TableWidget.transformToViewModel!([{ name: 'Z' }], { columns: 'unique-id, name' });
            expect(vm.rows[0]).toEqual({ id: '0', data: { 'unique-id': '0', name: 'Z' } });
        });

        it('injects id into data when requested in columns', () => {
            const vm = TableWidget.transformToViewModel!([{ name: 'Y' }], { columns: 'id, name' });
            expect(vm.rows[0]).toEqual({ id: '0', data: { id: '0', name: 'Y' } });
        });

        it('uses custom key', () => {
            const vm = TableWidget.transformToViewModel!([{ key: 'abc', name: 'Test' }], { key: 'key' });
            expect(vm.rows[0].id).toBe('abc');
            expect(vm.rows[0].data).toEqual({ key: 'abc', name: 'Test' });
        });

        it('handles missing/non-string key by falling back to index', () => {
            const vm = TableWidget.transformToViewModel!([{ id: 123 }, { id: null }, {}], { key: 'id' });
            expect(vm.rows.length).toBe(3);
            expect(vm.rows[0].id).toBe('123'); // numeric id is stringified, not dropped
            expect(vm.rows[1].id).toBe('1');   // null -> fallback
            expect(vm.rows[2].id).toBe('2');   // missing -> fallback
        });
    });

    describe('transformToViewModel (object context)', () => {
        it('expands object entries where values are objects and attaches key', () => {
            const input = { foo: { name: 'Foo' }, bar: { name: 'Bar' } };
            const vm = TableWidget.transformToViewModel!(input, {});
            expect(vm.flatTable).toBe(false);
            expect(vm.rows.length).toBe(2);
            expect(vm.rows[0]).toEqual({ id: 'foo', data: { name: 'Foo', 'unique-id': 'foo' } });
            expect(vm.rows[1]).toEqual({ id: 'bar', data: { name: 'Bar', 'unique-id': 'bar' } });
        });

        it('expands primitive values into { value, key } records', () => {
            const input = { a: 1, b: 'x', c: { y: 2 } };
            const vm = TableWidget.transformToViewModel!(input, {});
            const asMap = Object.fromEntries(vm.rows.map(r => [r.id, r.data]));
            expect(asMap['a']).toEqual({ value: 1, 'unique-id': 'a' });
            expect(asMap['b']).toEqual({ value: 'x', 'unique-id': 'b' });
            expect(asMap['c']).toEqual({ y: 2, 'unique-id': 'c' });
        });

        it('single-row with columns when object itself has those columns', () => {
            const input = { a: 1, b: 2, 'unique-id': 'row1', extra: undefined };
            const vm = TableWidget.transformToViewModel!(input, { columns: 'a, b' });
            expect(vm.flatTable).toBe(true);
            expect(vm.rows.length).toBe(1);
            expect(vm.rows[0]).toEqual({ id: '0', data: { a: 1, b: 2 } });
        });


        it('object with nested values and columns does not flatten (flatTable=false)', () => {
            const input = { foo: { a: 1, b: 2 }, bar: { a: 3, b: 4 } };
            const vm = TableWidget.transformToViewModel!(input, { columns: 'a' });
            expect(vm.flatTable).toBe(false);
            expect(vm.rows[0]).toEqual({ id: 'foo', data: { a: 1, b: 2, 'unique-id': 'foo' } });
            expect(vm.rows[1]).toEqual({ id: 'bar', data: { a: 3, b: 4, 'unique-id': 'bar' } });
        });

        it('orientation="vertical" keeps single row; with columns uses only those fields', () => {
            const input = { a: 1, b: 2, c: 3 };
            const vm = TableWidget.transformToViewModel!(input, { orientation: 'vertical', columns: 'a, c' });
            expect(vm.isVertical).toBe(true);
            expect(vm.flatTable).toBe(true);
            expect(vm.rows.length).toBe(1);
            expect(vm.rows[0]).toEqual({ id: '0', data: { a: 1, c: 3 } });
        });
    });

    describe('error handling', () => {
        it('throws on unsupported context', () => {
            // @ts-expect-error – intentionally passing wrong type to validate error branch
            expect(() => TableWidget.transformToViewModel!('nope', {})).toThrow();
        });
    });

    describe('registerHelpers', () => {
        it('exposes objectEntries and and, and they behave', () => {
            expect(TableWidget.registerHelpers).toBeDefined();
            const helpers = TableWidget.registerHelpers!();
            const { objectEntries, and } = helpers;
            expect(typeof objectEntries).toBe('function');
            expect(typeof and).toBe('function');
            expect(objectEntries({ a: 1, b: 2 })).toEqual([
                { id: 'a', data: 1 },
                { id: 'b', data: 2 },
            ]);
            expect(objectEntries(null)).toEqual([]);
            expect(objectEntries([1, 2, 3])).toEqual([]);
            const opts: Record<string, never> = {};
            expect(and(true, true, opts)).toBe(true);
            expect(and(true, false, opts)).toBe(false);
            expect(and(1, 'x', opts)).toBe(true);
            expect(and(0, 'x', opts)).toBe(false);
        });
    });

});
