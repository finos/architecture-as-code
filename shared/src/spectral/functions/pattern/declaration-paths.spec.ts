import { choiceIdPaths, containingDeclaration, declarationPaths, declaredId, declaredIdPaths, declaredInterfaceIdPaths, exclusiveGroup, fixedIdPath, isAlternative, twoKeywordSites } from './declaration-paths';

const ENTRY = '/properties/nodes/prefixItems/0';
const ALTERNATIVE = `${ENTRY}/oneOf/1`;
const ID = '/properties/unique-id/const';
const INTERFACE_ID = '/properties/interfaces/prefixItems/0/properties/unique-id/const';

describe('declaration paths', () => {
    it('covers the fixed entry, both entry keywords and both items keywords', () => {
        expect(declarationPaths('relationships')).toEqual([
            '$.properties.relationships.prefixItems[*]',
            '$.properties.relationships.prefixItems[*].oneOf[*]',
            '$.properties.relationships.prefixItems[*].anyOf[*]',
            '$.properties.relationships.items.oneOf[*]',
            '$.properties.relationships.items.anyOf[*]'
        ]);
    });

    it('names every site a choice can declare both keywords at', () => {
        expect(twoKeywordSites()).toEqual([
            '$.properties.nodes.prefixItems[?(@.oneOf && @.anyOf)]',
            '$.properties.nodes[?(@property === "items" && @.oneOf && @.anyOf)]',
            '$.properties.relationships.prefixItems[?(@.oneOf && @.anyOf)]',
            '$.properties.relationships[?(@property === "items" && @.oneOf && @.anyOf)]'
        ]);
    });

    it('builds id paths from the fixed entry followed by the alternatives', () => {
        expect(declaredIdPaths('nodes')).toEqual([fixedIdPath('nodes'), ...choiceIdPaths('nodes')]);
    });

    it('reaches interfaces on every node declaration site', () => {
        expect(declaredInterfaceIdPaths()).toHaveLength(declarationPaths('nodes').length);
        expect(declaredInterfaceIdPaths()[0]).toBe('$.properties.nodes.prefixItems[*].properties.interfaces.prefixItems[*].properties.unique-id.const');
    });

    it('reads the id off a declaration', () => {
        expect(declaredId({ properties: { 'unique-id': { const: 'webapp' } } })).toBe('webapp');
        expect(declaredId({ oneOf: [] })).toBeUndefined();
    });
});

describe('declaration pointers', () => {
    it.each([
        ['a fixed node id', `${ENTRY}${ID}`, ENTRY, ENTRY, false],
        ['an alternative node id', `${ALTERNATIVE}${ID}`, ALTERNATIVE, ENTRY, true],
        ['a fixed interface id', `${ENTRY}${INTERFACE_ID}`, ENTRY, ENTRY, false],
        ['an alternative interface id', `${ALTERNATIVE}${INTERFACE_ID}`, ALTERNATIVE, ENTRY, true],
        ['a relationship alternative', '/properties/relationships/prefixItems/2/anyOf/0' + ID,
            '/properties/relationships/prefixItems/2/anyOf/0', '/properties/relationships/prefixItems/2', true],
    ])('resolves %s', (_name, pointer, declaration, entry, alternative) => {
        expect(containingDeclaration(pointer)).toBe(declaration);
        expect(exclusiveGroup(pointer)).toBe(entry);
        expect(isAlternative(pointer)).toBe(alternative);
    });

    it('leaves a pointer from outside these paths alone', () => {
        expect(containingDeclaration('/properties/metadata/0')).toBe('/properties/metadata/0');
        expect(isAlternative('/properties/metadata/0')).toBe(false);
    });
});
