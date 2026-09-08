import { asContext } from '../spectral-test-helpers';
import { prefixItemsDeclaresOneKeyword } from './prefix-items-declares-one-keyword';

const node = (id: string) => ({ properties: { 'unique-id': { const: id } } });

function contextFor(nodes: object) {
    return {
        document: { data: { properties: { nodes } } },
        path: []
    };
}

describe('prefixItemsDeclaresOneKeyword', () => {
    it('should return an empty array when there is no input', () => {
        const context = contextFor({ prefixItems: [{ oneOf: [node('cache')], anyOf: [node('queue')] }] });

        const result = prefixItemsDeclaresOneKeyword(null, null, asContext(context));
        expect(result).toEqual([]);
    });

    it('should report an entry whose keywords name different alternatives', () => {
        const context = contextFor({ prefixItems: [{ oneOf: [node('cache')], anyOf: [node('queue')] }] });

        const result = prefixItemsDeclaresOneKeyword({}, null, asContext(context));
        expect(result.length).toBe(1);
        expect(result[0].message).toContain('A prefixItems entry declares both \'oneOf\' and \'anyOf\'');
        expect(result[0].path).toEqual(['properties', 'nodes', 'prefixItems', '0']);
    });

    it('should report an entry whose keywords overlap', () => {
        const context = contextFor({ prefixItems: [{ oneOf: [node('cache'), node('queue')], anyOf: [node('cache')] }] });

        const result = prefixItemsDeclaresOneKeyword({}, null, asContext(context));
        expect(result.length).toBe(1);
    });

    it('should return an empty array when an entry declares one keyword', () => {
        const context = contextFor({ prefixItems: [{ oneOf: [node('cache'), node('queue')] }] });

        const result = prefixItemsDeclaresOneKeyword({}, null, asContext(context));
        expect(result).toEqual([]);
    });

    it('should return an empty array for a bare node entry', () => {
        const context = contextFor({ prefixItems: [node('webapp')] });

        const result = prefixItemsDeclaresOneKeyword({}, null, asContext(context));
        expect(result).toEqual([]);
    });
});
