import patternRules from './rules-pattern';
import { runSpectralValidations } from '../commands/validate/validation-helpers';

async function issuesFor(pattern: object) {
    const result = await runSpectralValidations(JSON.stringify(pattern), patternRules, 'test');
    return result.spectralIssues;
}

async function codesFor(pattern: object): Promise<string[]> {
    return (await issuesFor(pattern)).map(issue => String(issue.code));
}

async function pathFor(pattern: object, code: string): Promise<string | undefined> {
    return (await issuesFor(pattern)).find(issue => String(issue.code) === code)?.path;
}

const node = (id: string) => ({ properties: { 'unique-id': { const: id } } });

const connects = (id: string, source: string, destination: string) => ({
    properties: {
        'unique-id': { const: id },
        'relationship-type': { const: { connects: { source: { node: source }, destination: { node: destination } } } }
    }
});

const decision = (id: string, nodeIds: string[]) => ({
    properties: {
        'unique-id': { const: id },
        description: { const: 'Pick an alternative' },
        'relationship-type': {
            properties: {
                options: {
                    prefixItems: [{
                        anyOf: nodeIds.map(nodeId => ({
                            properties: {
                                description: { const: `Use ${nodeId}` },
                                nodes: { const: [nodeId] },
                                relationships: { const: [] }
                            }
                        }))
                    }]
                }
            }
        }
    }
});

describe('pattern ruleset', () => {
    it('runs the ruleset at all', async () => {
        const codes = await codesFor({ properties: {} });
        expect(codes).toContain('pattern-has-nodes-relationships');
    });

    describe('pattern-nodes-must-be-referenced', () => {
        it('does not warn about an alternative that a decision references', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [node('webapp'), node('database'), { oneOf: [node('redis'), node('memcached')] }] },
                    relationships: {
                        prefixItems: [connects('w-d', 'webapp', 'database'), decision('pick', ['redis', 'memcached'])]
                    }
                }
            });
            expect(codes).not.toContain('pattern-nodes-must-be-referenced');
        });

        it('warns about an alternative that nothing references', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [node('webapp'), node('database'), { oneOf: [node('orphan')] }] },
                    relationships: { prefixItems: [connects('w-d', 'webapp', 'database')] }
                }
            });
            expect(codes).toContain('pattern-nodes-must-be-referenced');
        });
    });

    describe('pattern-choice-must-declare-one-keyword', () => {
        it('accepts an entry that declares one keyword', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [{ oneOf: [node('cache'), node('queue')] }] },
                    relationships: { prefixItems: [] }
                }
            });
            expect(codes).not.toContain('pattern-choice-must-declare-one-keyword');
        });

        it('rejects an entry that declares both keywords', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [{ oneOf: [node('cache')], anyOf: [node('queue')] }] },
                    relationships: { prefixItems: [] }
                }
            });
            expect(codes).toContain('pattern-choice-must-declare-one-keyword');
        });

        it('rejects a relationships entry that declares both keywords', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [node('webapp')] },
                    relationships: { prefixItems: [{ oneOf: [node('a')], anyOf: [node('b')] }] }
                }
            });
            expect(codes).toContain('pattern-choice-must-declare-one-keyword');
        });

        it('reports the location of the offending entry', async () => {
            const path = await pathFor({
                properties: {
                    nodes: { prefixItems: [{ oneOf: [node('cache')], anyOf: [node('queue')] }] },
                    relationships: { prefixItems: [] }
                }
            }, 'pattern-choice-must-declare-one-keyword');
            expect(path).toBe('/properties/nodes/prefixItems/0');
        });
    });

    describe('rules resolve alternatives, not prefixItems entries', () => {
        it('does not report a connects relationship whose source is an alternative', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [node('webapp'), { oneOf: [node('cache')] }] },
                    relationships: { prefixItems: [connects('c-w', 'cache', 'webapp')] }
                }
            });
            expect(codes).not.toContain('connects-relationship-references-existing-nodes-in-pattern');
        });

        it('reports a connects relationship whose source is an unknown node', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [node('webapp'), { oneOf: [node('cache')] }] },
                    relationships: { prefixItems: [connects('t-w', 'typo', 'webapp')] }
                }
            });
            expect(codes).toContain('connects-relationship-references-existing-nodes-in-pattern');
        });
    });
    describe('items', () => {
        it('resolves a node declared in items', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [node('webapp')], items: { oneOf: [node('cache')] } },
                    relationships: { prefixItems: [connects('w-c', 'cache', 'webapp'), decision('add-ons', ['cache'])] }
                }
            });
            expect(codes).not.toContain('connects-relationship-references-existing-nodes-in-pattern');
            expect(codes).not.toContain('pattern-nodes-must-be-referenced');
        });

        it('warns about an items member that nothing references', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [node('webapp'), node('database')], items: { oneOf: [node('orphan')] } },
                    relationships: { prefixItems: [connects('w-d', 'webapp', 'database')] }
                }
            });
            expect(codes).toContain('pattern-nodes-must-be-referenced');
        });

        it('reports an id shared by two items members, which can both appear', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [node('webapp')], items: { oneOf: [node('dup'), node('dup')] } },
                    relationships: { prefixItems: [] }
                }
            });
            expect(codes).toContain('unique-ids-must-be-unique-in-pattern');
        });

        it('reports an interface id shared by two items members, which can both appear', async () => {
            const cache = { properties: { 'unique-id': { const: 'cache' }, interfaces: { prefixItems: [{ properties: { 'unique-id': { const: 'port' } } }] } } };
            const queue = { properties: { 'unique-id': { const: 'queue' }, interfaces: { prefixItems: [{ properties: { 'unique-id': { const: 'port' } } }] } } };
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [node('webapp')], items: { oneOf: [cache, queue] } },
                    relationships: { prefixItems: [] }
                }
            });
            expect(codes).toContain('unique-ids-must-be-unique-in-pattern');
        });

        it('rejects an items block declaring both keywords', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [node('webapp')], items: { oneOf: [node('cache')], anyOf: [node('queue')] } },
                    relationships: { prefixItems: [] }
                }
            });
            expect(codes).toContain('pattern-choice-must-declare-one-keyword');
        });

        it('reports the location of the offending items block', async () => {
            const path = await pathFor({
                properties: {
                    nodes: { prefixItems: [node('webapp')], items: { oneOf: [node('cache')], anyOf: [node('queue')] } },
                    relationships: { prefixItems: [] }
                }
            }, 'pattern-choice-must-declare-one-keyword');
            expect(path).toBe('/properties/nodes/items');
        });
    });

    describe('pattern-decision-must-be-declared-in-prefix-items', () => {
        it('accepts a decision declared in relationships prefixItems', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [node('webapp')], items: { oneOf: [node('cache')] } },
                    relationships: { prefixItems: [decision('add-ons', ['cache'])] }
                }
            });
            expect(codes).not.toContain('pattern-decision-must-be-declared-in-prefix-items');
        });

        it('rejects a decision declared in relationships items', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [node('webapp')], items: { oneOf: [node('cache')] } },
                    relationships: { prefixItems: [], items: { oneOf: [decision('add-ons', ['cache'])] } }
                }
            });
            expect(codes).toContain('pattern-decision-must-be-declared-in-prefix-items');
        });

        it('accepts a plain relationship declared in relationships items', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [node('webapp'), node('database')] },
                    relationships: { prefixItems: [], items: { anyOf: [connects('w-d', 'webapp', 'database')] } }
                }
            });
            expect(codes).not.toContain('pattern-decision-must-be-declared-in-prefix-items');
        });
    });
    describe('pattern-items-must-fit-within-max-items', () => {
        it('rejects a pattern whose maxItems leaves no room for items', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { minItems: 1, maxItems: 1, prefixItems: [node('webapp')], items: { oneOf: [node('cache')] } },
                    relationships: { prefixItems: [] }
                }
            });
            expect(codes).toContain('pattern-items-must-fit-within-max-items');
        });

        it('accepts a pattern whose maxItems leaves room', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { minItems: 1, maxItems: 2, prefixItems: [node('webapp')], items: { oneOf: [node('cache')] } },
                    relationships: { prefixItems: [] }
                }
            });
            expect(codes).not.toContain('pattern-items-must-fit-within-max-items');
        });

        it('accepts a pattern that declares no maxItems', async () => {
            const codes = await codesFor({
                properties: {
                    nodes: { prefixItems: [node('webapp')], items: { oneOf: [node('cache')] } },
                    relationships: { prefixItems: [] }
                }
            });
            expect(codes).not.toContain('pattern-items-must-fit-within-max-items');
        });
    });
});
