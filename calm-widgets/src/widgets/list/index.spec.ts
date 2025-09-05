import { describe, it, expect } from 'vitest';
import { ListWidget } from './index';

describe('ListWidget', () => {
    it('transforms array of strings', () => {
        const input = ['alpha', 'beta', 'gamma'];
        const vm = ListWidget.transformToViewModel!(input, { ordered: false });
        expect(vm).toEqual({ items: input, ordered: false });
    });

    it('transforms array of objects without property filter', () => {
        const input = [
            { id: '1', name: 'Alice' },
            { id: '2', name: 'Bob', extra: undefined }
        ];
        const vm = ListWidget.transformToViewModel!(input, {});
        expect(vm.items).toEqual([
            'id: 1, name: Alice',
            'id: 2, name: Bob'
        ]);
    });

    it('transforms array with mixed types and property filter', () => {
        const input = [
            { id: '1', name: 'Alice' },
            { id: '2', name: 'Bob', extra: undefined },
            { id: '3', name: undefined },
            { id: '4' }, // no name
            { id: '5', name: 123 },
            { id: '6', name: { nested: true } },
            'unstructured'
        ];

        const vm = ListWidget.transformToViewModel!(input, {
            property: 'name'
        });

        expect(vm.items).toEqual([
            'Alice',
            'Bob',
            '123',
            'unstructured'
        ]);
    });

    it('filters out undefined and empty items', () => {
        const input = [
            undefined,
            null,
            {},
            { name: undefined },
            'valid',
        ] as never[];

        const vm = ListWidget.transformToViewModel!(input, {
            property: 'name'
        });

        expect(vm.items).toEqual(['valid']);
    });

    it('marks ordered correctly', () => {
        const vm1 = ListWidget.transformToViewModel!(['a', 'b'], {
            ordered: true
        });
        const vm2 = ListWidget.transformToViewModel!(['a', 'b'], {
            ordered: false
        });

        expect(vm1.ordered).toBe(true);
        expect(vm2.ordered).toBe(false);
    });

    it('validates proper context', () => {
        expect(ListWidget.validateContext(['a', { b: 1 }])).toBe(true);
        expect(ListWidget.validateContext([{ b: 1 }, null, 'x'])).toBe(false);
        expect(ListWidget.validateContext([1, 2, 3])).toBe(false);
    });
});
