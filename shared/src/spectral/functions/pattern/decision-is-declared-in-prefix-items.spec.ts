import { RulesetFunctionContext } from '@stoplight/spectral-core';
import { decisionIsDeclaredInPrefixItems } from './decision-is-declared-in-prefix-items';

const asContext = () => ({ path: ['properties', 'relationships', 'items', 'oneOf', 0] } as unknown as RulesetFunctionContext);

const decision = (id: string) => ({
    properties: {
        'unique-id': { const: id },
        'relationship-type': { properties: { options: { prefixItems: [] } } }
    }
});

const connects = (id: string) => ({
    properties: {
        'unique-id': { const: id },
        'relationship-type': { const: { connects: { source: { node: 'a' }, destination: { node: 'b' } } } }
    }
});

describe('decisionIsDeclaredInPrefixItems', () => {
    it('reports a decision', () => {
        const results = decisionIsDeclaredInPrefixItems(decision('add-ons'), null, asContext());
        expect(results).toHaveLength(1);
        expect(results[0].message).toContain('The decision \'add-ons\' is declared in items');
    });

    it('reports at the path of the declaration', () => {
        const results = decisionIsDeclaredInPrefixItems(decision('add-ons'), null, asContext());
        expect(results[0].path).toEqual(['properties', 'relationships', 'items', 'oneOf', 0]);
    });

    it('names the decision as unknown when it declares no id', () => {
        const anonymous = { properties: { 'relationship-type': { properties: { options: {} } } } };
        expect(decisionIsDeclaredInPrefixItems(anonymous, null, asContext())[0].message).toContain('\'unknown\'');
    });

    it('accepts a relationship that is not a decision', () => {
        expect(decisionIsDeclaredInPrefixItems(connects('w-d'), null, asContext())).toEqual([]);
    });

    it('accepts no input', () => {
        expect(decisionIsDeclaredInPrefixItems(undefined, null, asContext())).toEqual([]);
    });
});
