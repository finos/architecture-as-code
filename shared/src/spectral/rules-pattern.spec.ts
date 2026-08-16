import { describe, it, expect } from 'vitest';
import patternRules from './rules-pattern';
import { runSpectralValidations } from '../commands/validate/validation-helpers';

const RULE = 'pattern-option-relationship-must-be-in-prefix-items';

/** A decision holder: a relationship carrying `relationship-type.options`. */
function decisionHolder() {
    return {
        properties: {
            'unique-id': { const: 'connection-options' },
            'description': { const: 'Which optional components do you want?' },
            'relationship-type': {
                properties: {
                    options: {
                        prefixItems: [{
                            anyOf: [{
                                properties: {
                                    description: { const: 'Add a cache' },
                                    nodes: { const: ['cache'] },
                                    relationships: { const: ['app-to-cache'] }
                                }
                            }]
                        }]
                    }
                }
            }
        }
    };
}

/** A plain relationship candidate - legal inside an items catalog. */
function candidateRelationship(id: string) {
    return { properties: { 'unique-id': { const: id }, 'description': { const: `the ${id} link` } } };
}

async function ruleCodesFor(pattern: object): Promise<string[]> {
    const result = await runSpectralValidations(JSON.stringify(pattern), patternRules, 'test');
    return result.spectralIssues.map(issue => issue.code);
}

describe('pattern-option-relationship-must-be-in-prefix-items', () => {
    it('passes when the decision holder is in prefixItems and only candidates are in the items catalog', async () => {
        const pattern = {
            properties: {
                nodes: { prefixItems: [] },
                relationships: {
                    prefixItems: [decisionHolder()],
                    items: { oneOf: [candidateRelationship('app-to-cache'), candidateRelationship('app-to-queue')] }
                }
            }
        };

        expect(await ruleCodesFor(pattern)).not.toContain(RULE);
    });

    it('fails when the decision holder is declared inside an items.oneOf catalog', async () => {
        const pattern = {
            properties: {
                nodes: { prefixItems: [] },
                relationships: {
                    prefixItems: [],
                    items: { oneOf: [decisionHolder(), candidateRelationship('app-to-cache')] }
                }
            }
        };

        expect(await ruleCodesFor(pattern)).toContain(RULE);
    });

    it('fails when the decision holder is declared inside an items.anyOf catalog', async () => {
        const pattern = {
            properties: {
                nodes: { prefixItems: [] },
                relationships: {
                    prefixItems: [],
                    items: { anyOf: [decisionHolder()] }
                }
            }
        };

        expect(await ruleCodesFor(pattern)).toContain(RULE);
    });

    it('fails when the misplaced decision holder sits inside an allOf branch', async () => {
        const pattern = {
            allOf: [{
                properties: {
                    nodes: { prefixItems: [] },
                    relationships: {
                        prefixItems: [],
                        items: { oneOf: [decisionHolder()] }
                    }
                }
            }]
        };

        expect(await ruleCodesFor(pattern)).toContain(RULE);
    });

    it('does not fire for a nodes items catalog, which never holds decisions', async () => {
        const pattern = {
            properties: {
                nodes: {
                    prefixItems: [],
                    items: { oneOf: [{ properties: { 'unique-id': { const: 'cache' }, 'description': { const: 'a cache' } } }] }
                },
                relationships: { prefixItems: [decisionHolder()] }
            }
        };

        expect(await ruleCodesFor(pattern)).not.toContain(RULE);
    });
});
