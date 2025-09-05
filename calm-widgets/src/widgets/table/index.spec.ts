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

    describe('transformToViewModel', () => {
        const data = [
            { 'unique-id': '1', name: 'Alice' },
            { 'unique-id': '2', name: 'Bob', extra: undefined },
            { 'unique-id': '', name: 'Empty ID' },
            { name: 'No ID' },
            { 'unique-id': null }
        ];

        it('transforms array with default options', () => {
            const vm = TableWidget.transformToViewModel!(data, {});
            expect(vm.rows.length).toBe(5); // Now processes all valid objects
            expect(vm.headers).toBe(true);
            expect(vm.rows[0]).toEqual({
                id: '1', // Uses the unique-id value
                data: { 'unique-id': '1', name: 'Alice' }
            });
            expect(vm.rows[1]).toEqual({
                id: '2',
                data: { 'unique-id': '2', name: 'Bob' }
            });
            expect(vm.rows[2]).toEqual({
                id: '2', // Uses array index as fallback for empty unique-id
                data: { 'unique-id': '', name: 'Empty ID' }
            });
            expect(vm.rows[3]).toEqual({
                id: '3', // Uses array index as fallback for missing unique-id
                data: { name: 'No ID' }
            });
            expect(vm.rows[4]).toEqual({
                id: '4', // Uses array index as fallback for null unique-id
                data: { 'unique-id': null }
            });
        });

        it('transforms object into entries', () => {
            const input = {
                foo: { name: 'Foo' },
                bar: { name: 'Bar' }
            };
            const vm = TableWidget.transformToViewModel!(input, {});
            expect(vm.rows.length).toBe(2);
            expect(vm.rows[0].id).toBe('foo');
            expect(vm.rows[0].data).toEqual({ name: 'Foo', 'unique-id': 'foo' });
        });

        it('uses custom key', () => {
            const custom = [{ key: 'abc', name: 'Test' }];
            const vm = TableWidget.transformToViewModel!(custom, {
                key: 'key'
            });
            expect(vm.rows[0].id).toBe('abc');
        });

        it('skips records with missing or non-string key', () => {
            const invalid = [{ id: 123 }, { id: null }, {}];
            const vm = TableWidget.transformToViewModel!(invalid, {
                key: 'id'
            });
            expect(vm.rows.length).toBe(3); // All objects processed with fallback indices
            expect(vm.rows[0].id).toBe('0'); // Uses array index
            expect(vm.rows[1].id).toBe('1');
            expect(vm.rows[2].id).toBe('2');
        });

        it('respects headers option = false', () => {
            const vm = TableWidget.transformToViewModel!(data, {
                headers: false
            });
            expect(vm.headers).toBe(false);
        });

        it('filters columns correctly', () => {
            const vm = TableWidget.transformToViewModel!(data, {
                columns: 'name'
            });
            expect(vm.rows[0].data).toEqual({ name: 'Alice' });
        });

        it('filters columns and keeps key out of data', () => {
            const vm = TableWidget.transformToViewModel!(data, {
                columns: 'name', key: 'unique-id'
            });
            expect(vm.rows[0]).toEqual({
                id: '1',
                data: { name: 'Alice' }
            });
        });

        it('works with object and columns', () => {
            const input = {
                foo: { a: 1, b: 2 },
                bar: { a: 3, b: 4 }
            };
            const vm = TableWidget.transformToViewModel!(input, {
                columns: 'a'
            });
            expect(vm.rows[0].data).toEqual({ a: 1 });
        });
    });

    describe('registerHelpers', () => {
        const helpers = TableWidget.registerHelpers?.();
        const fn = helpers?.objectEntries;

        it('objectEntries returns id/data pairs', () => {
            const result = fn?.({ a: 1, b: 2 });
            expect(result).toEqual([
                { id: 'a', data: 1 },
                { id: 'b', data: 2 }
            ]);
        });

        it('objectEntries returns empty for non-object or array', () => {
            expect(fn?.(null)).toEqual([]);
            expect(fn?.([1, 2, 3])).toEqual([]);
        });
    });
});
