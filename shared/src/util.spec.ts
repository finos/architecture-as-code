import { mergeSchemas, updateStringValuesRecursively } from './util';

describe('updateStringValuesRecursively', () => {
    it('Should update string values at top level', () => {
        const object = {
            'stringKey': 'abcd'
        };
        const mapped = updateStringValuesRecursively(object, (key, value) => value.toUpperCase());
        expect(mapped['stringKey']).toEqual('ABCD');
    });

    it('Should ignore non-string values at top level', () => {
        let wasCalled = false;
        const object = {
            'intKey': 123,
            'nullKey': null
        };
        updateStringValuesRecursively(object, (key, value) => { 
            wasCalled = true;
            return value;
        });
        expect(wasCalled).toBeFalsy();
    });
    
    it('Should update string values recursively, passing key', () => {
        const object = {
            'innerObj': {
                'modify': 'abcd'
            },
            'innerObj2': {
                'ignore': 'abcd'
            }
        };
        const mapped = updateStringValuesRecursively(object, (key, value) => key === 'modify'
            ? value.toUpperCase()
            : value);
        expect(mapped['innerObj']['modify']).toEqual('ABCD');
        expect(mapped['innerObj2']['ignore']).toEqual('abcd');
    });

    it('Should recurse into objects nested within arrays', () => {
        // Note: bare string elements of an array are not transformed; only string
        // values held under object keys are. This exercises the array branch.
        const object = {
            'items': ['a', { 'nested': 'b' }, 'c']
        };
        const mapped = updateStringValuesRecursively(object, (_key, value) => value.toUpperCase());
        expect(mapped['items']).toEqual(['a', { 'nested': 'B' }, 'c']);
    });
});

describe('mergeSchemas', () => {
    it('merges properties from both schemas, with the second taking precedence', () => {
        const merged = mergeSchemas(
            { properties: { a: 1, b: 2 } },
            { properties: { b: 3, c: 4 } }
        ) as { properties: Record<string, number> };
        expect(merged.properties).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('unions the required arrays of both schemas', () => {
        const merged = mergeSchemas(
            { required: ['a', 'b'] },
            { required: ['b', 'c'] }
        ) as { required: string[] };
        expect(merged.required).toEqual(['a', 'b', 'c']);
    });

    it('defaults required to an empty array when neither schema declares it', () => {
        const merged = mergeSchemas({ type: 'object' }, { title: 'x' }) as { required: string[] };
        expect(merged.required).toEqual([]);
    });
});