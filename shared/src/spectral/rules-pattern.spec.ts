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

async function ruleSeverityFor(pattern: object, code: string): Promise<string | undefined> {
    const result = await runSpectralValidations(JSON.stringify(pattern), patternRules, 'test');
    return result.spectralIssues.find((issue) => issue.code === code)?.severity;
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

describe('pattern-items-catalog-must-declare-one-choice-keyword', () => {
    const RULE_BOTH = 'pattern-items-catalog-must-declare-one-choice-keyword';

    function candidate(id: string) {
        return { properties: { 'unique-id': { const: id } } };
    }

    it('reports when a nodes catalog declares both oneOf and anyOf', async () => {
        const codes = await ruleCodesFor({
            properties: {
                nodes: { prefixItems: [], items: { oneOf: [candidate('a')], anyOf: [candidate('b')] } },
                relationships: { prefixItems: [] }
            }
        });
        expect(codes).toContain(RULE_BOTH);
    });

    it('reports it as a warning, not an error', async () => {
        // Declaring both is legal JSON Schema - both keywords apply, which for distinct
        // `const` ids is unsatisfiable - so it is a smell, not an invalid document. The
        // harm it can cause is caught in `selectChoices`, which throws when a chosen
        // bundle names a candidate selection cannot reach.
        const severity = await ruleSeverityFor({
            properties: {
                nodes: { prefixItems: [], items: { oneOf: [candidate('a')], anyOf: [candidate('b')] } },
                relationships: { prefixItems: [] }
            }
        }, RULE_BOTH);
        expect(severity).toBe('warning');
    });

    it('reports when a relationships catalog declares both', async () => {
        const codes = await ruleCodesFor({
            properties: {
                nodes: { prefixItems: [] },
                relationships: { prefixItems: [], items: { oneOf: [candidate('r1')], anyOf: [candidate('r2')] } }
            }
        });
        expect(codes).toContain(RULE_BOTH);
    });

    it('reports a catalog declared inside an allOf branch', async () => {
        const codes = await ruleCodesFor({
            allOf: [{
                properties: {
                    nodes: { prefixItems: [], items: { oneOf: [candidate('a')], anyOf: [candidate('b')] } },
                    relationships: { prefixItems: [] }
                }
            }]
        });
        expect(codes).toContain(RULE_BOTH);
    });

    it('passes a catalog declaring only oneOf', async () => {
        const codes = await ruleCodesFor({
            properties: {
                nodes: { prefixItems: [], items: { oneOf: [candidate('a'), candidate('b')] } },
                relationships: { prefixItems: [] }
            }
        });
        expect(codes).not.toContain(RULE_BOTH);
    });

    it('passes a catalog declaring only anyOf', async () => {
        const codes = await ruleCodesFor({
            properties: {
                nodes: { prefixItems: [], items: { anyOf: [candidate('a'), candidate('b')] } },
                relationships: { prefixItems: [] }
            }
        });
        expect(codes).not.toContain(RULE_BOTH);
    });

    it('leaves a plain items schema alone — it is not a catalog', async () => {
        const codes = await ruleCodesFor({
            properties: {
                nodes: { prefixItems: [candidate('a')], items: false },
                relationships: { prefixItems: [] }
            }
        });
        expect(codes).not.toContain(RULE_BOTH);
    });
});

describe('pattern-decision-must-reference-selectable-nodes', () => {
    const RULE_SELECTABLE = 'pattern-decision-must-reference-selectable-nodes';
    const TYPO_RULE = 'group-relationship-with-const-nodes-references-existing-nodes-in-pattern';

    function candidateNode(id: string) {
        return { properties: { 'unique-id': { const: id }, name: { const: id }, 'node-type': { const: 'service' } } };
    }

    function decisionNaming(id: string) {
        return {
            properties: {
                'unique-id': { const: 'choice' },
                description: { const: 'Pick one' },
                'relationship-type': {
                    type: 'object',
                    properties: {
                        options: {
                            type: 'array',
                            prefixItems: [{
                                oneOf: [{
                                    properties: {
                                        description: { const: 'Use it' },
                                        nodes: { const: [id] },
                                        relationships: { const: [] }
                                    }
                                }]
                            }]
                        }
                    }
                }
            }
        };
    }

    it('errors when a decision names a candidate in the losing keyword of a dual-keyword catalog', async () => {
        const codes = await ruleCodesFor({
            properties: {
                nodes: { prefixItems: [candidateNode('webapp')], items: { oneOf: [candidateNode('redis')], anyOf: [candidateNode('kafka')] } },
                relationships: { prefixItems: [decisionNaming('kafka')] }
            }
        });
        expect(codes).toContain(RULE_SELECTABLE);
    });

    it('errors for the same shape declared as a prefixItems slot rather than a catalog', async () => {
        const codes = await ruleCodesFor({
            properties: {
                nodes: { prefixItems: [candidateNode('webapp'), { oneOf: [candidateNode('a')], anyOf: [candidateNode('b')] }] },
                relationships: { prefixItems: [decisionNaming('b')] }
            }
        });
        expect(codes).toContain(RULE_SELECTABLE);
    });

    it('reports it as an error - the same harm as naming a candidate that does not exist', async () => {
        const severity = await ruleSeverityFor({
            properties: {
                nodes: { prefixItems: [candidateNode('webapp')], items: { oneOf: [candidateNode('redis')], anyOf: [candidateNode('kafka')] } },
                relationships: { prefixItems: [decisionNaming('kafka')] }
            }
        }, RULE_SELECTABLE);
        expect(severity).toBe('error');
    });

    it('leaves a plain typo to the existing rule rather than double-reporting it', async () => {
        const codes = await ruleCodesFor({
            properties: {
                nodes: { prefixItems: [candidateNode('webapp')], items: { oneOf: [candidateNode('redis')] } },
                relationships: { prefixItems: [decisionNaming('rediss')] }
            }
        });
        expect(codes).toContain(TYPO_RULE);
        expect(codes).not.toContain(RULE_SELECTABLE);
    });

    it('passes a decision naming a reachable catalog candidate', async () => {
        const codes = await ruleCodesFor({
            properties: {
                nodes: { prefixItems: [candidateNode('webapp')], items: { oneOf: [candidateNode('redis')] } },
                relationships: { prefixItems: [decisionNaming('redis')] }
            }
        });
        expect(codes).not.toContain(RULE_SELECTABLE);
    });

    it('passes a decision naming a reachable slot alternative', async () => {
        const codes = await ruleCodesFor({
            properties: {
                nodes: { prefixItems: [candidateNode('webapp'), { oneOf: [candidateNode('a'), candidateNode('b')] }] },
                relationships: { prefixItems: [decisionNaming('a')] }
            }
        });
        expect(codes).not.toContain(RULE_SELECTABLE);
    });
});
