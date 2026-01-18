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

        it('accepts null and undefined (renders empty table)', () => {
            expect(TableWidget.validateContext(null)).toBe(true);
            expect(TableWidget.validateContext(undefined)).toBe(true);
        });

        it('rejects invalid types', () => {
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

    describe('empty-message option', () => {
        it('includes emptyMessage in view model when provided', () => {
            const vm = TableWidget.transformToViewModel!([], { 'empty-message': 'No data available' });
            expect(vm.emptyMessage).toBe('No data available');
            expect(vm.rows).toEqual([]);
        });

        it('includes emptyMessage when context is null', () => {
            // @ts-expect-error – validateContext accepts null but type doesn't reflect it
            const vm = TableWidget.transformToViewModel!(null, { 'empty-message': 'No items found' });
            expect(vm.emptyMessage).toBe('No items found');
            expect(vm.rows).toEqual([]);
        });

        it('includes emptyMessage when context is undefined', () => {
            // @ts-expect-error – validateContext accepts undefined but type doesn't reflect it
            const vm = TableWidget.transformToViewModel!(undefined, { 'empty-message': 'Nothing here' });
            expect(vm.emptyMessage).toBe('Nothing here');
            expect(vm.rows).toEqual([]);
        });

        it('does not include emptyMessage when not provided', () => {
            const vm = TableWidget.transformToViewModel!([], {});
            expect(vm.emptyMessage).toBeUndefined();
        });

        it('includes emptyMessage even when table has data', () => {
            const vm = TableWidget.transformToViewModel!([{ a: 1 }], { 'empty-message': 'No data' });
            expect(vm.emptyMessage).toBe('No data');
            expect(vm.rows.length).toBe(1);
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

    describe('sections parameter', () => {
        const nodeContext = {
            'unique-id': 'test-node',
            'name': 'Test Node',
            'description': 'A test node for testing',
            'node-type': 'service',
            'custom-property': 'custom-value',
            'another-property': 42,
            'interfaces': [{ 'unique-id': 'interface-1' }],
            'controls': { 'security': {} },
            'metadata': { 'key': 'value' },
            'details': { 'detailed-architecture': 'some-link' },
        };

        describe('overview section', () => {
            it('includes only the four overview columns', () => {
                const vm = TableWidget.transformToViewModel!(nodeContext, {
                    sections: 'overview',
                    orientation: 'vertical'
                });
                expect(vm.columnNames).toEqual(['unique-id', 'name', 'description', 'node-type']);
                expect(vm.rows[0].data).toEqual({
                    'unique-id': 'test-node',
                    'name': 'Test Node',
                    'description': 'A test node for testing',
                    'node-type': 'service',
                });
            });
        });

        describe('extended section', () => {
            it('includes additional properties excluding overview and schema-defined optional properties', () => {
                const vm = TableWidget.transformToViewModel!(nodeContext, {
                    sections: 'extended',
                    orientation: 'vertical'
                });
                // Should include custom-property and another-property
                // Should NOT include: unique-id, name, description, node-type (overview)
                // Should NOT include: interfaces, controls, metadata, details (schema optional)
                expect(vm.columnNames).toEqual(['custom-property', 'another-property']);
                expect(vm.rows[0].data).toEqual({
                    'custom-property': 'custom-value',
                    'another-property': 42,
                });
            });

            it('returns empty rows when no extended properties exist', () => {
                const minimalNode = {
                    'unique-id': 'minimal',
                    'name': 'Minimal',
                    'description': 'Minimal node',
                    'node-type': 'service',
                };
                const vm = TableWidget.transformToViewModel!(minimalNode, {
                    sections: 'extended',
                    orientation: 'vertical'
                });
                expect(vm.rows).toEqual([]);
                expect(vm.columnNames).toBeUndefined();
            });

            it('returns empty rows with emptyMessage when no extended properties exist', () => {
                const minimalNode = {
                    'unique-id': 'minimal',
                    'name': 'Minimal',
                    'description': 'Minimal node',
                    'node-type': 'service',
                };
                const vm = TableWidget.transformToViewModel!(minimalNode, {
                    sections: 'extended',
                    orientation: 'vertical',
                    'empty-message': 'There are no additional properties'
                });
                expect(vm.rows).toEqual([]);
                expect(vm.emptyMessage).toBe('There are no additional properties');
            });
        });

        describe('metadata section', () => {
            it('includes metadata column when metadata exists', () => {
                const vm = TableWidget.transformToViewModel!(nodeContext, {
                    sections: 'metadata',
                    orientation: 'vertical'
                });
                expect(vm.columnNames).toEqual(['metadata']);
                expect(vm.rows[0].data).toEqual({
                    'metadata': { 'key': 'value' },
                });
            });

            it('returns empty columns when metadata does not exist', () => {
                const nodeWithoutMetadata = {
                    'unique-id': 'no-meta',
                    'name': 'No Meta',
                    'description': 'Node without metadata',
                    'node-type': 'service',
                };
                const vm = TableWidget.transformToViewModel!(nodeWithoutMetadata, {
                    sections: 'metadata',
                    orientation: 'vertical'
                });
                expect(vm.rows).toEqual([]);
                expect(vm.columnNames).toBeUndefined();
            });

            it('returns empty rows with emptyMessage when section produces no columns', () => {
                const nodeWithoutMetadata = {
                    'unique-id': 'no-meta',
                    'name': 'No Meta',
                    'description': 'Node without metadata',
                    'node-type': 'service',
                };
                const vm = TableWidget.transformToViewModel!(nodeWithoutMetadata, {
                    sections: 'metadata',
                    orientation: 'vertical',
                    'empty-message': 'There is no metadata'
                });
                expect(vm.rows).toEqual([]);
                expect(vm.emptyMessage).toBe('There is no metadata');
            });

            it('handles metadata being explicitly undefined (e.g., from toCanonicalSchema)', () => {
                // This tests the scenario where metadata key exists but value is undefined
                // which can happen when toCanonicalSchema() adds all optional properties
                const nodeWithUndefinedMetadata = {
                    'unique-id': 'undef-meta',
                    'name': 'Undefined Meta',
                    'description': 'Node with undefined metadata property',
                    'node-type': 'service',
                    'metadata': undefined,
                };
                const vm = TableWidget.transformToViewModel!(nodeWithUndefinedMetadata, {
                    sections: 'metadata',
                    orientation: 'vertical',
                    'empty-message': 'There is no metadata'
                });
                expect(vm.rows).toEqual([]);
                expect(vm.hasRows).toBe(false);
                expect(vm.emptyMessage).toBe('There is no metadata');
            });

            it('handles metadata being null', () => {
                const nodeWithNullMetadata = {
                    'unique-id': 'null-meta',
                    'name': 'Null Meta',
                    'description': 'Node with null metadata property',
                    'node-type': 'service',
                    'metadata': null,
                };
                const vm = TableWidget.transformToViewModel!(nodeWithNullMetadata, {
                    sections: 'metadata',
                    orientation: 'vertical',
                    'empty-message': 'There is no metadata'
                });
                expect(vm.rows).toEqual([]);
                expect(vm.hasRows).toBe(false);
                expect(vm.emptyMessage).toBe('There is no metadata');
            });

            it('treats metadata as empty object as having data (empty object is valid)', () => {
                // An empty object {} is still truthy and treated as valid metadata
                // even though it has no keys - this is the expected behavior
                const nodeWithEmptyMetadata = {
                    'unique-id': 'empty-meta',
                    'name': 'Empty Meta',
                    'description': 'Node with empty metadata object',
                    'node-type': 'service',
                    'metadata': {},
                };
                const vm = TableWidget.transformToViewModel!(nodeWithEmptyMetadata, {
                    sections: 'metadata',
                    orientation: 'vertical',
                    'empty-message': 'There is no metadata'
                });
                // Empty object is truthy, so metadata is included even though it has no keys
                expect(vm.columnNames).toEqual(['metadata']);
                expect(vm.rows[0].data).toEqual({ 'metadata': {} });
            });
        });

        describe('combined sections', () => {
            it('combines overview and extended sections', () => {
                const vm = TableWidget.transformToViewModel!(nodeContext, {
                    sections: 'overview, extended',
                    orientation: 'vertical'
                });
                expect(vm.columnNames).toEqual([
                    'unique-id', 'name', 'description', 'node-type',
                    'custom-property', 'another-property'
                ]);
            });

            it('combines all three sections', () => {
                const vm = TableWidget.transformToViewModel!(nodeContext, {
                    sections: 'overview, extended, metadata',
                    orientation: 'vertical'
                });
                expect(vm.columnNames).toEqual([
                    'unique-id', 'name', 'description', 'node-type',
                    'custom-property', 'another-property',
                    'metadata'
                ]);
            });

            it('does not duplicate columns across sections', () => {
                const vm = TableWidget.transformToViewModel!(nodeContext, {
                    sections: 'overview, overview',
                    orientation: 'vertical'
                });
                expect(vm.columnNames).toEqual(['unique-id', 'name', 'description', 'node-type']);
            });
        });

        describe('sections with explicit columns', () => {
            it('adds explicit columns after section columns', () => {
                const vm = TableWidget.transformToViewModel!(nodeContext, {
                    sections: 'overview',
                    columns: 'custom-property',
                    orientation: 'vertical'
                });
                expect(vm.columnNames).toEqual([
                    'unique-id', 'name', 'description', 'node-type',
                    'custom-property'
                ]);
            });

            it('does not duplicate columns when explicit column is in sections', () => {
                const vm = TableWidget.transformToViewModel!(nodeContext, {
                    sections: 'overview',
                    columns: 'name, custom-property',
                    orientation: 'vertical'
                });
                // 'name' is already in overview, so it should not be duplicated
                expect(vm.columnNames).toEqual([
                    'unique-id', 'name', 'description', 'node-type',
                    'custom-property'
                ]);
            });
        });

        describe('sections with array context', () => {
            it('ignores sections parameter for array context', () => {
                const arrayContext = [
                    { 'unique-id': '1', 'name': 'First', 'custom': 'value1' },
                    { 'unique-id': '2', 'name': 'Second', 'custom': 'value2' },
                ];
                const vm = TableWidget.transformToViewModel!(arrayContext, {
                    sections: 'overview',
                    columns: 'name, custom'
                });
                // For array context, sections is ignored, explicit columns are used
                expect(vm.columnNames).toEqual(['name', 'custom']);
            });
        });

        describe('invalid sections', () => {
            it('ignores invalid section names', () => {
                const vm = TableWidget.transformToViewModel!(nodeContext, {
                    sections: 'overview, invalid, extended',
                    orientation: 'vertical'
                });
                // 'invalid' should be ignored
                expect(vm.columnNames).toEqual([
                    'unique-id', 'name', 'description', 'node-type',
                    'custom-property', 'another-property'
                ]);
            });

            it('handles empty sections string', () => {
                const vm = TableWidget.transformToViewModel!(nodeContext, {
                    sections: '',
                    orientation: 'vertical'
                });
                // Empty sections should behave as if no sections were specified
                expect(vm.columnNames).toEqual(Object.keys(nodeContext));
            });
        });

        describe('case insensitivity', () => {
            it('handles uppercase section names', () => {
                const vm = TableWidget.transformToViewModel!(nodeContext, {
                    sections: 'OVERVIEW',
                    orientation: 'vertical'
                });
                expect(vm.columnNames).toEqual(['unique-id', 'name', 'description', 'node-type']);
            });

            it('handles mixed case section names', () => {
                const vm = TableWidget.transformToViewModel!(nodeContext, {
                    sections: 'Overview, EXTENDED',
                    orientation: 'vertical'
                });
                expect(vm.columnNames).toEqual([
                    'unique-id', 'name', 'description', 'node-type',
                    'custom-property', 'another-property'
                ]);
            });
        });
    });

    describe('additionalProperties flattening', () => {
        it('merges properties from additionalProperties into the main object', () => {
            const context = {
                'unique-id': 'test-node',
                'name': 'Test Node',
                'additionalProperties': {
                    'custom-prop-1': 'value1',
                    'custom-prop-2': 42
                }
            };
            const vm = TableWidget.transformToViewModel!(context, {
                orientation: 'vertical'
            });

            // additionalProperties should be flattened and their values accessible
            expect(vm.rows[0].data['custom-prop-1']).toBe('value1');
            expect(vm.rows[0].data['custom-prop-2']).toBe(42);
        });

        it('removes the additionalProperties wrapper key from final data', () => {
            const context = {
                'unique-id': 'test-node',
                'additionalProperties': {
                    'custom-prop': 'value'
                }
            };
            const vm = TableWidget.transformToViewModel!(context, {
                orientation: 'vertical'
            });

            // The additionalProperties wrapper should not appear in the data
            expect(vm.rows[0].data).not.toHaveProperty('additionalProperties');
        });

        it('includes additionalProperties in extended section', () => {
            const context = {
                'unique-id': 'test-node',
                'name': 'Test Node',
                'description': 'A test',
                'node-type': 'service',
                'additionalProperties': {
                    'custom-prop': 'extended-value'
                }
            };
            const vm = TableWidget.transformToViewModel!(context, {
                sections: 'extended',
                orientation: 'vertical'
            });

            // Extended section should include flattened additionalProperties
            expect(vm.columnNames).toContain('custom-prop');
            expect(vm.rows[0].data['custom-prop']).toBe('extended-value');
        });

        it('handles duplicate keys - additionalProperties values take precedence', () => {
            // When the same key exists in both the main object and additionalProperties,
            // the spread operator makes additionalProperties take precedence
            const context = {
                'unique-id': 'test-node',
                'custom-prop': 'original-value',
                'additionalProperties': {
                    'custom-prop': 'overridden-value'
                }
            };
            const vm = TableWidget.transformToViewModel!(context, {
                orientation: 'vertical'
            });

            // additionalProperties value should override the main object value
            expect(vm.rows[0].data['custom-prop']).toBe('overridden-value');
        });

        it('handles empty additionalProperties object', () => {
            const context = {
                'unique-id': 'test-node',
                'name': 'Test Node',
                'additionalProperties': {}
            };
            const vm = TableWidget.transformToViewModel!(context, {
                orientation: 'vertical'
            });

            // Should work normally with no additional properties
            expect(vm.rows[0].data).toHaveProperty('unique-id');
            expect(vm.rows[0].data).toHaveProperty('name');
            expect(vm.rows[0].data).not.toHaveProperty('additionalProperties');
        });

        it('handles non-object additionalProperties (should be ignored)', () => {
            const context = {
                'unique-id': 'test-node',
                'name': 'Test Node',
                'additionalProperties': 'not-an-object'
            };
            const vm = TableWidget.transformToViewModel!(context, {
                orientation: 'vertical'
            });

            // Non-object additionalProperties should be ignored (not flattened)
            // but the key itself may still appear in the data
            expect(vm.rows[0].data).toHaveProperty('unique-id');
            expect(vm.rows[0].data).toHaveProperty('name');
        });

        it('handles additionalProperties being null', () => {
            const context = {
                'unique-id': 'test-node',
                'name': 'Test Node',
                'additionalProperties': null
            };
            const vm = TableWidget.transformToViewModel!(context, {
                orientation: 'vertical'
            });

            // Null additionalProperties should be handled gracefully
            expect(vm.rows[0].data).toHaveProperty('unique-id');
            expect(vm.rows[0].data).toHaveProperty('name');
        });

        it('handles additionalProperties being undefined', () => {
            const context = {
                'unique-id': 'test-node',
                'name': 'Test Node',
                'additionalProperties': undefined
            };
            const vm = TableWidget.transformToViewModel!(context, {
                orientation: 'vertical'
            });

            // Undefined additionalProperties should be handled gracefully
            expect(vm.rows[0].data).toHaveProperty('unique-id');
            expect(vm.rows[0].data).toHaveProperty('name');
        });

        it('handles nested objects within additionalProperties', () => {
            const context = {
                'unique-id': 'test-node',
                'additionalProperties': {
                    'nested-config': {
                        'setting1': 'value1',
                        'setting2': 123
                    }
                }
            };
            const vm = TableWidget.transformToViewModel!(context, {
                orientation: 'vertical'
            });

            // Nested objects should be preserved as-is for recursive table rendering
            expect(vm.rows[0].data['nested-config']).toEqual({
                'setting1': 'value1',
                'setting2': 123
            });
        });
    });

});
