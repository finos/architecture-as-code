import { describe, it, expect, vi, beforeEach } from 'vitest';
import { instantiate } from './instantiate';
import { assertChoicesAreSelectable, extractOptions, selectChoices, CalmChoice, CalmOption } from './options';
import { flattenAllOf } from './flatten-allof';
import { SchemaDirectory } from '../../../schema-directory';

/**
 * End-to-end coverage for items-catalog decisions: a holder in `relationships.prefixItems`
 * selecting candidates from a `nodes.items` catalog.
 *
 * Driven the way `calm generate` drives it - `extractOptions`, then `selectChoices`, then
 * `instantiate`. The catalog tests in `instantiate.spec.ts` hand-build their choices, so
 * they prove a catalog can be consumed but not that a decision is discoverable.
 */

vi.mock('fs');

vi.mock('../../../logger', () => ({
    initLogger: vi.fn(function () {
        return { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
    })
}));

const schemaDirMocks = vi.hoisted(() => ({
    loadSchemas: vi.fn(),
    loadCurrentPatternAsSchema: vi.fn(),
    getDefinition: vi.fn()
}));

vi.mock('../../../schema-directory', () => ({
    SchemaDirectory: vi.fn(function () {
        return {
            loadSchemas: schemaDirMocks.loadSchemas,
            loadCurrentPatternAsSchema: schemaDirMocks.loadCurrentPatternAsSchema,
            getDefinition: schemaDirMocks.getDefinition
        };
    }),
}));

interface InstantiatedArchitecture {
    nodes: Array<Record<string, unknown>>;
    relationships: Array<Record<string, unknown>>;
}

function node(uniqueId: string, name: string) {
    return {
        properties: {
            'unique-id': { const: uniqueId },
            'name': { const: name },
            'node-type': { const: 'service' }
        }
    };
}

function choice(description: string, nodeId: string) {
    return {
        properties: {
            description: { const: description },
            nodes: { const: [nodeId] },
            relationships: { const: [] }
        }
    };
}

/** A decision holder: a relationship carrying `relationship-type.options`. */
function decision(uniqueId: string, prompt: string, blockType: 'oneOf' | 'anyOf', choices: object[]) {
    return {
        properties: {
            'unique-id': { const: uniqueId },
            'description': { const: prompt },
            'relationship-type': {
                type: 'object',
                properties: {
                    options: {
                        type: 'array',
                        prefixItems: [{ [blockType]: choices }]
                    }
                }
            }
        }
    };
}

/**
 * One mandatory node, four optional candidates in a single catalog, and two independent
 * decisions drawing from it. A pattern has exactly one nodes catalog and only a catalog
 * can express an optional node, so this is the shape any pattern offering two optional
 * components must take.
 */
const twoDecisionPattern = {
    $schema: 'schema#',
    $id: 'two-decision-catalog-pattern',
    properties: {
        nodes: {
            type: 'array',
            prefixItems: [node('webapp', 'Web App')],
            items: {
                anyOf: [
                    node('redis', 'Redis'),
                    node('memcached', 'Memcached'),
                    node('kafka', 'Kafka'),
                    node('rabbitmq', 'RabbitMQ'),
                ]
            }
        },
        relationships: {
            type: 'array',
            prefixItems: [
                decision('cache-choice', 'Pick a cache', 'anyOf', [
                    choice('Use Redis', 'redis'),
                    choice('Use Memcached', 'memcached'),
                ]),
                decision('queue-choice', 'Pick a queue', 'anyOf', [
                    choice('Use Kafka', 'kafka'),
                    choice('Use RabbitMQ', 'rabbitmq'),
                ]),
            ]
        }
    }
};

async function generate(pattern: object, chosen: CalmChoice[]): Promise<InstantiatedArchitecture> {
    const selected = selectChoices(pattern, chosen);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await instantiate(selected, false, new SchemaDirectory({} as any)) as unknown as InstantiatedArchitecture;
}

const nodeIds = (arch: InstantiatedArchitecture) => arch.nodes.map((n) => n['unique-id']);

/** Finds a named choice on a named decision, the way the CLI resolves `--option-choices`. */
function pick(options: CalmOption[], optionId: string, description: string): CalmChoice {
    const option = options.find((o) => o.optionId === optionId);
    if (!option) throw new Error(`no such decision: ${optionId}`);
    const found = option.choices.find((c) => c.description === description);
    if (!found) throw new Error(`no such choice on ${optionId}: ${description}`);
    return found;
}

describe('items catalog decisions, end to end', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        schemaDirMocks.getDefinition.mockResolvedValue({ type: 'object', properties: {} });
    });

    describe('discovery', () => {
        it('offers both decisions, each with its own prompt and choices', () => {
            const options = extractOptions(twoDecisionPattern);

            expect(options.map((o) => o.optionId)).toEqual(['cache-choice', 'queue-choice']);
            expect(options.map((o) => o.prompt)).toEqual(['Pick a cache', 'Pick a queue']);
            expect(options.every((o) => o.optionType === 'anyOf')).toBe(true);
            expect(options[0].choices.map((c) => c.description)).toEqual(['Use Redis', 'Use Memcached']);
            expect(options[1].choices.map((c) => c.description)).toEqual(['Use Kafka', 'Use RabbitMQ']);
        });

        it('names only catalog candidates in its choices', () => {
            const options = extractOptions(twoDecisionPattern);
            expect(options.flatMap((o) => o.choices.flatMap((c) => c.nodes)))
                .toEqual(['redis', 'memcached', 'kafka', 'rabbitmq']);
        });
    });

    describe('zero or more selection', () => {
        it('materializes nothing from the catalog when no choice is made', async () => {
            const arch = await generate(twoDecisionPattern, []);
            expect(nodeIds(arch)).toEqual(['webapp']);
        });

        it('materializes one candidate per answered decision', async () => {
            const options = extractOptions(twoDecisionPattern);
            const arch = await generate(twoDecisionPattern, [
                pick(options, 'cache-choice', 'Use Redis'),
                pick(options, 'queue-choice', 'Use Kafka'),
            ]);
            expect(nodeIds(arch)).toEqual(['webapp', 'redis', 'kafka']);
        });

        it('answers each decision independently — one answered, one left alone', async () => {
            const options = extractOptions(twoDecisionPattern);
            const arch = await generate(twoDecisionPattern, [
                pick(options, 'queue-choice', 'Use RabbitMQ'),
            ]);
            expect(nodeIds(arch)).toEqual(['webapp', 'rabbitmq']);
        });

        it('accepts several answers to one anyOf decision', async () => {
            const options = extractOptions(twoDecisionPattern);
            const arch = await generate(twoDecisionPattern, [
                pick(options, 'cache-choice', 'Use Redis'),
                pick(options, 'cache-choice', 'Use Memcached'),
            ]);
            expect(nodeIds(arch)).toEqual(['webapp', 'redis', 'memcached']);
        });

        it('records the answer on the decision holder, which survives into the architecture', async () => {
            // The holder is not scaffolding that gets stripped - it stays, carrying the
            // chosen bundle, so the generated architecture records which option was taken.
            const options = extractOptions(twoDecisionPattern);
            const arch = await generate(twoDecisionPattern, [pick(options, 'cache-choice', 'Use Redis')]);

            const holder = arch.relationships.find((r) => r['unique-id'] === 'cache-choice');
            expect(holder).toBeDefined();
            expect(holder!['description']).toBe('Pick a cache');

            const relationshipType = holder!['relationship-type'] as Record<string, unknown>;
            const recorded = relationshipType['options'] as Array<Record<string, unknown>>;
            expect(recorded.map((o) => o['description'])).toEqual(['Use Redis']);
            expect(recorded.flatMap((o) => o['nodes'] as string[])).toEqual(['redis']);
        });

        it('drops the unchosen alternatives from the recorded answer', async () => {
            const options = extractOptions(twoDecisionPattern);
            const arch = await generate(twoDecisionPattern, [pick(options, 'cache-choice', 'Use Memcached')]);

            const holder = arch.relationships.find((r) => r['unique-id'] === 'cache-choice')!;
            const recorded = (holder['relationship-type'] as Record<string, unknown>)['options'] as Array<Record<string, unknown>>;
            expect(recorded.map((o) => o['description'])).toEqual(['Use Memcached']);
        });

        it('clears the catalog so the array is fully expressed by prefixItems', async () => {
            const selected = selectChoices(twoDecisionPattern, []) as Record<string, never>;
            const nodes = selected['properties']['nodes'];
            expect(nodes['items']).toBeUndefined();
            expect(nodes['prefixItems']).toHaveLength(1);
        });
    });

    describe('mandatory nodes are unaffected by decisions', () => {
        it('always emits the prefixItems node regardless of answers', async () => {
            const options = extractOptions(twoDecisionPattern);
            const none = await generate(twoDecisionPattern, []);
            const all = await generate(twoDecisionPattern, [
                pick(options, 'cache-choice', 'Use Redis'),
                pick(options, 'cache-choice', 'Use Memcached'),
                pick(options, 'queue-choice', 'Use Kafka'),
                pick(options, 'queue-choice', 'Use RabbitMQ'),
            ]);
            expect(nodeIds(none)).toContain('webapp');
            expect(nodeIds(all)).toEqual(['webapp', 'redis', 'memcached', 'kafka', 'rabbitmq']);
        });
    });
});

describe('an answer that cannot be honoured is refused, not discarded', () => {
    // The check lives on the generate path (runGenerate calls it), deliberately not inside
    // selectChoices - validation calls selectChoices too, to replay an architecture's
    // options onto its pattern, and a malformed pattern must surface its own schema errors
    // there rather than be pre-empted by this one.
    // extractOptions builds the prompt straight from a choice bundle without checking its
    // ids resolve, so the user is offered the choice either way. Before this guard the
    // answer was silently dropped and the architecture generated without it.
    const catalogPattern = (items: object) => ({
        $schema: 'schema#', $id: 'unreachable',
        properties: {
            nodes: { type: 'array', prefixItems: [node('webapp', 'Web App')], items },
            relationships: { type: 'array', prefixItems: [] },
        }
    });

    it('throws when a choice bundle names a node id that does not exist', () => {
        const pattern = catalogPattern({ oneOf: [node('redis', 'Redis')] });
        expect(() => assertChoicesAreSelectable(pattern, [
            { description: 'Use Redis', nodes: ['rediss'], relationships: [] },
        ])).toThrow(/rediss/);
    });

    it('throws when a catalog declares both keywords, making the anyOf side unreachable', () => {
        // Legal JSON Schema, but only the oneOf list is resolved, so kafka can never be
        // selected even though validation sees it as a properly declared node.
        const pattern = catalogPattern({ oneOf: [node('redis', 'Redis')], anyOf: [node('kafka', 'Kafka')] });
        expect(() => assertChoicesAreSelectable(pattern, [
            { description: 'Use Kafka', nodes: ['kafka'], relationships: [] },
        ])).toThrow(/kafka/);
    });

    it('throws when a bundle names an unreachable relationship id', () => {
        const pattern = {
            $schema: 'schema#', $id: 'unreachable-rel',
            properties: {
                nodes: { type: 'array', prefixItems: [node('webapp', 'Web App')] },
                relationships: { type: 'array', prefixItems: [] },
            }
        };
        expect(() => assertChoicesAreSelectable(pattern, [
            { description: 'Link them', nodes: [], relationships: ['ghost-link'] },
        ])).toThrow(/ghost-link/);
    });

    it('accepts ids reachable through a catalog, a slot, or a plain entry', () => {
        expect(() => assertChoicesAreSelectable(catalogPattern({ oneOf: [node('redis', 'Redis')] }), [
            { description: 'Use Redis', nodes: ['redis'], relationships: [] },
        ])).not.toThrow();

        const slotPattern = {
            $schema: 'schema#', $id: 'slot',
            properties: {
                nodes: { type: 'array', prefixItems: [{ oneOf: [node('a', 'A'), node('b', 'B')] }] },
                relationships: { type: 'array', prefixItems: [] },
            }
        };
        expect(() => assertChoicesAreSelectable(slotPattern, [
            { description: 'Use A', nodes: ['a'], relationships: [] },
        ])).not.toThrow();
    });
});

/**
 * Pins the real division of labour for a decision declared inside an `allOf` branch:
 * `extractOptions` discovers it on the raw pattern (`getPatternArray` falls back into
 * `allOf`, matching what `main` already did by hand before this reader existed), and
 * `runGenerate` flattens the same raw pattern with `flattenAllOf` - pre-existing, unrelated
 * to this PR - before the guard or selection ever run. Neither the guard nor selection has
 * ever tolerated a raw `allOf` pattern; `main`'s own `flattenCalmItems` threw on one with no
 * fallback at all. So the guard is exercised here the way `runGenerate` actually calls it -
 * post-flatten - not directly against the raw pattern `extractOptions` reads.
 */
describe('decisions declared under allOf', () => {
    const allOfDecisionPattern = {
        $schema: 'schema#',
        $id: 'allof-decision-pattern',
        allOf: [
            {
                properties: {
                    nodes: {
                        type: 'array',
                        prefixItems: [node('webapp', 'Web App')],
                        items: { anyOf: [node('redis', 'Redis'), node('memcached', 'Memcached')] }
                    },
                    relationships: {
                        type: 'array',
                        prefixItems: [
                            decision('cache-choice', 'Pick a cache', 'anyOf', [
                                choice('Use Redis', 'redis'),
                                choice('Use Memcached', 'memcached'),
                            ])
                        ]
                    }
                }
            }
        ]
    };

    it('are discovered by extractOptions', () => {
        const options = extractOptions(allOfDecisionPattern);
        expect(options.map((o) => o.optionId)).toEqual(['cache-choice']);
    });

    it('accept an answer the guard can resolve to a real candidate, once flattened as runGenerate flattens it', async () => {
        const options = extractOptions(allOfDecisionPattern);
        const chosen = pick(options, 'cache-choice', 'Use Redis');

        const flattened = await flattenAllOf(allOfDecisionPattern, new SchemaDirectory({} as never), false);
        expect(() => assertChoicesAreSelectable(flattened as never, [chosen])).not.toThrow();
    });
});
