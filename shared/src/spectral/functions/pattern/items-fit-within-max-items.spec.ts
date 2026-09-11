import { RulesetFunctionContext } from '@stoplight/spectral-core';
import { itemsFitWithinMaxItems } from './items-fit-within-max-items';

const asContext = () => ({ path: ['properties', 'nodes'] } as unknown as RulesetFunctionContext);
const run = (array: unknown) => itemsFitWithinMaxItems(array, null, asContext());

const choice = { oneOf: [{}] };

describe('itemsFitWithinMaxItems', () => {
    it('reports an array whose entries already fill maxItems', () => {
        const result = run({ prefixItems: [{}], maxItems: 1, items: choice });
        expect(result).toHaveLength(1);
        expect(result[0].message).toContain('maxItems is 1 and 1 prefixItems entries already fill it');
    });

    it('reports an array with no entries and no room', () => {
        expect(run({ maxItems: 0, items: choice })).toHaveLength(1);
    });

    it('reports at the path of the array', () => {
        expect(run({ prefixItems: [{}], maxItems: 1, items: choice })[0].path).toEqual(['properties', 'nodes']);
    });

    it('accepts an array with room to spare', () => {
        expect(run({ prefixItems: [{}], maxItems: 2, items: choice })).toEqual([]);
    });

    it('accepts an array that declares no maxItems', () => {
        expect(run({ prefixItems: [{}], items: choice })).toEqual([]);
    });

    it('accepts an array with no items block', () => {
        expect(run({ prefixItems: [{}], maxItems: 1 })).toEqual([]);
    });

    it('accepts an items block that offers no choice', () => {
        expect(run({ prefixItems: [{}], maxItems: 1, items: { $ref: 'core.json#/defs/node' } })).toEqual([]);
    });

    it('accepts an anyOf items block with room', () => {
        expect(run({ prefixItems: [{}], maxItems: 3, items: { anyOf: [{}] } })).toEqual([]);
    });

    it('accepts no input', () => {
        expect(run(undefined)).toEqual([]);
    });
});
