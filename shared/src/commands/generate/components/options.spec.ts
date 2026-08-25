 

import { assertChoicesAreSelectable, CalmChoice, CalmOption, extractOptions, selectChoices } from './options';

const applicationAtoC: CalmChoice = {
    description: 'Application A connects to Application C',
    nodes: ['application-a'],
    relationships: ['application-a-to-c']
}; 

const applicationBtoC: CalmChoice = {
    description: 'Application B connects to Application C',
    nodes: ['application-b'],
    relationships: ['application-b-to-c']
};

const applicationXtoZ: CalmChoice = {
    description: 'Application X connects to Application Z',
    nodes: ['application-x'],
    relationships: ['application-x-to-z']
};

const applicationYtoZ: CalmChoice = {
    description: 'Application Y connects to Application Z',
    nodes: ['application-y'],
    relationships: ['application-y-to-z']
};

function buildPatternChoice({ description, nodes, relationships }: CalmChoice) {
    return {
        'properties': {
            'description': {
                'const': description
            },
            'nodes': {
                'const': nodes
            },
            'relationships': {
                'const': relationships
            }
        }
    };
}

function buildPatternOption(optionType: 'oneOf' | 'anyOf', ...choices: object[]) {
    const option: Record<string, object[]> = {};
    option[optionType] = choices;
    return option;
}

function buildNode(uniqueId: string): object {
    return {
        '$ref': 'https://calm.finos.org/release/1.0-rc2/meta/core.json#/defs/node',
        'type': 'object',
        'properties': {
            'unique-id': {
                'const': uniqueId
            },
            'name': {
                'const': uniqueId + ' name'
            },
            'description': {
                'const': uniqueId + ' description'
            },
            'node-type': {
                'const': 'service'
            }
        }
    };
}

function buildConnectsRelationship(id: string, prompt: string, source: string, destination: string): object {
    return {
        '$ref': 'https://calm.finos.org/release/1.0-rc2/meta/core.json#/defs/relationship',
        'type': 'object',
        'properties': {
            'unique-id': {
                'const': id
            },
            'description': {
                'const': prompt
            },
            'relationship-type': {
                'const': {
                    'connects': {
                        'source': { 'node': source },
                        'destination': { 'node': destination }
                    }
                }
            }
        }
    };
}

function buildPatternOptionRelationship(id: string, prompt: string, ...options: object[]): object {
    return {
        'properties': {
            'unique-id': {
                'const': id
            },
            'description': {
                'const': prompt
            },
            'relationship-type': {
                'type': 'object',
                'properties': {
                    'options': {
                        'prefixItems': options
                    }
                }
            }
        }
    };
}

function buildPattern(nodes: object[], relationships: object[]) {
    return {
        'properties': {
            'nodes': {
                'prefixItems': nodes
            },
            'relationships': {
                'prefixItems': relationships
            }
        }
    };
}

// Builds a pattern with mandatory prefixItems plus an open items.oneOf/anyOf catalog
function buildPatternWithItemsCatalog(
    mandatoryNodes: object[],
    catalogNodes: object[],
    relationships: object[] = [],
    catalogRelationships: object[] = []
) {
    return {
        'properties': {
            'nodes': {
                'prefixItems': mandatoryNodes,
                ...(catalogNodes.length > 0 && { 'items': { 'oneOf': catalogNodes } }),
            },
            'relationships': {
                'prefixItems': relationships,
                ...(catalogRelationships.length > 0 && { 'items': { 'oneOf': catalogRelationships } }),
            },
        },
    };
}

describe('Pattern Options', () => {
    describe('optionsFor', () => {
        it('should return a oneOf option from a spec', () => {
            const applicationAtoC: CalmChoice = {
                description: 'Application A connects to Application C',
                nodes: ['application-a'],
                relationships: ['application-a-to-c']
            }; 

            const applicationBtoC: CalmChoice = {
                description: 'Application B connects to Application C',
                nodes: ['application-b'],
                relationships: ['application-b-to-c']
            };

            const pattern = buildPattern(
                [],
                [
                    buildPatternOptionRelationship(
                        'option-id',
                        'The choice of nodes and relationships in the pattern', 
                        buildPatternOption('oneOf', buildPatternChoice(applicationAtoC), buildPatternChoice(applicationBtoC))
                    )
                ]
            );

            const expectedOptions: CalmOption[] = [{
                optionType: 'oneOf',
                optionId: 'option-id',
                prompt: 'The choice of nodes and relationships in the pattern',
                choices: [applicationAtoC, applicationBtoC]
            }];

            expect(extractOptions(pattern)).toEqual(expectedOptions);
        });

        it('should return an anyOf option from a spec', () => {
            const pattern = buildPattern(
                [],
                [buildPatternOptionRelationship(
                    'option-id',
                    'The choice of nodes and relationships in the pattern',
                    buildPatternOption('anyOf', buildPatternChoice(applicationAtoC), buildPatternChoice(applicationBtoC))
                )]
            );

            const expectedOptions: CalmOption[] = [{
                optionType: 'anyOf',
                optionId: 'option-id',
                prompt: 'The choice of nodes and relationships in the pattern',
                choices: [applicationAtoC, applicationBtoC]
            }];

            expect(extractOptions(pattern)).toEqual(expectedOptions);
        });

        it('should return no options from a spec that contains no options relationship', () => {
            const patternWithNoRelationships = {
                'properties': {
                    'relationships': {
                        'prefixItems': []
                    }
                }
            };

            expect(extractOptions(patternWithNoRelationships)).toEqual([]);
        });

        it('should return multiple options from a spec', () => {
            const pattern = buildPattern(
                [],
                [
                    buildPatternOptionRelationship(
                        'option-id',
                        'The choice of node A or node B connecting to node C',
                        buildPatternOption('oneOf', buildPatternChoice(applicationAtoC), buildPatternChoice(applicationBtoC))
                    ),
                    buildPatternOptionRelationship(
                        'option-id-2',
                        'The choice of node X or node Y connecting to node Z',
                        buildPatternOption('anyOf', buildPatternChoice(applicationXtoZ), buildPatternChoice(applicationYtoZ))
                    )
                ]
            );

            const expectedOptions: CalmOption[] = [
                {
                    optionType: 'oneOf',
                    optionId: 'option-id',
                    prompt: 'The choice of node A or node B connecting to node C',
                    choices: [applicationAtoC, applicationBtoC]
                },
                {
                    optionType: 'anyOf',
                    optionId: 'option-id-2',
                    prompt: 'The choice of node X or node Y connecting to node Z',
                    choices: [applicationXtoZ, applicationYtoZ]
                }
            ];

            expect(extractOptions(pattern)).toEqual(expectedOptions);
        });
    });

    describe('selectChoices', () => {
        it('should remove items not selected from pattern', () => {
            const applicationA = buildNode('application-a');
            const applicationB = buildNode('application-b');
            const applicationC = buildNode('application-c');
            const connectsRelationshipA = buildConnectsRelationship('application-a-to-c', 'app a to app c', 'application-a', 'application-c');
            const connectsRelationshipB = buildConnectsRelationship('application-b-to-c', 'app b to app c', 'application-b', 'application-c');

            const pattern = buildPattern(
                [
                    { 'oneOf': [ applicationA, applicationB ] },
                    applicationC
                ],
                [
                    buildPatternOptionRelationship(
                        'option-id',
                        'The choice of nodes and relationships in the pattern', 
                        buildPatternOption('oneOf', buildPatternChoice(applicationAtoC), buildPatternChoice(applicationBtoC))
                    ),
                    {
                        'oneOf': [ connectsRelationshipA, connectsRelationshipB ]
                    }
                ]
            );

            // only choose app a, NOT app b
            const choices: CalmChoice[] = [applicationAtoC];

            const expectedPattern = buildPattern(
                [applicationA, applicationC],
                [
                    buildPatternOptionRelationship(
                        'option-id',
                        'The choice of nodes and relationships in the pattern', 
                        buildPatternChoice(applicationAtoC)
                    ),
                    connectsRelationshipA,
                ]
            );
            expect(selectChoices(pattern, choices)).toEqual(expectedPattern);
        });

        it('should not mutate the input pattern', () => {
            const applicationA = buildNode('application-a');
            const applicationB = buildNode('application-b');
            const connectsRelationshipA = buildConnectsRelationship('application-a-to-c', 'app a to app c', 'application-a', 'application-c');
            const connectsRelationshipB = buildConnectsRelationship('application-b-to-c', 'app b to app c', 'application-b', 'application-c');

            const pattern = buildPattern(
                [
                    { 'anyOf': [ applicationA, applicationB ] }
                ],
                [
                    buildPatternOptionRelationship(
                        'option-id',
                        'The choice of nodes and relationships in the pattern',
                        buildPatternOption('anyOf', buildPatternChoice(applicationAtoC), buildPatternChoice(applicationBtoC))
                    ),
                    {
                        'anyOf': [ connectsRelationshipA, connectsRelationshipB ]
                    }
                ]
            );
            const patternBeforeSelection = structuredClone(pattern);

            selectChoices(pattern, [applicationAtoC]);

            expect(pattern).toEqual(patternBeforeSelection);
        });

        it('should move selected items-catalog candidates into prefixItems', () => {
            const webapp = buildNode('webapp');
            const cache = buildNode('cache');
            const queue = buildNode('queue');

            const pattern = buildPatternWithItemsCatalog([webapp], [cache, queue]);

            const cacheChoice: CalmChoice = { description: 'Use cache', nodes: ['cache'], relationships: [] };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = selectChoices(pattern, [cacheChoice]) as any;

            expect(result.properties.nodes.prefixItems).toEqual([webapp, cache]);
            expect(result.properties.nodes.items).toBeUndefined();
        });

        it('should keep only the mandatory nodes when no items-catalog candidates are selected', () => {
            const webapp = buildNode('webapp');
            const cache = buildNode('cache');
            const queue = buildNode('queue');

            const pattern = buildPatternWithItemsCatalog([webapp], [cache, queue]);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = selectChoices(pattern, []) as any;

            expect(result.properties.nodes.prefixItems).toEqual([webapp]);
        });

        it('should not throw when a calmType has only an items catalog and no prefixItems', () => {
            const cache = buildNode('cache');
            const pattern = {
                'properties': {
                    'nodes': { 'items': { 'oneOf': [cache] } },
                    'relationships': { 'prefixItems': [] },
                },
            };

            const cacheChoice: CalmChoice = { description: 'Use cache', nodes: ['cache'], relationships: [] };

            expect(() => selectChoices(pattern, [cacheChoice])).not.toThrow();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = selectChoices(pattern, [cacheChoice]) as any;
            expect(result.properties.nodes.prefixItems).toEqual([cache]);
        });

        it('should move a selected items-catalog relationship into prefixItems and delete items', () => {
            const webapp = buildNode('webapp');
            const edge = buildConnectsRelationship('webapp-to-db', 'webapp to db', 'webapp', 'db');

            const pattern = buildPatternWithItemsCatalog([webapp], [], [], [edge]);

            const wireChoice: CalmChoice = { description: 'Wire db', nodes: [], relationships: ['webapp-to-db'] };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = selectChoices(pattern, [wireChoice]) as any;

            expect(result.properties.relationships.prefixItems).toEqual([edge]);
            expect(result.properties.relationships.items).toBeUndefined();
        });

        it('should not throw when a pattern has a nodes items catalog and no relationships property', () => {
            const cache = buildNode('cache');
            // No `relationships` property at all - the shape a nodes-only catalog pattern takes.
            const pattern = {
                'properties': {
                    'nodes': { 'items': { 'oneOf': [cache] } },
                },
            };

            const cacheChoice: CalmChoice = { description: 'Use cache', nodes: ['cache'], relationships: [] };

            expect(() => selectChoices(pattern, [cacheChoice])).not.toThrow();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = selectChoices(pattern, [cacheChoice]) as any;
            expect(result.properties.nodes.prefixItems).toEqual([cache]);
        });

        it('recovers from a malformed items-catalog oneOf ({}) via the sibling anyOf, instead of throwing', () => {
            // `oneOf: {}` is not an array, so the old `??`-based selection treated it as
            // present and threw ("catalogAlternatives.filter is not a function") instead of
            // falling through to the valid `anyOf`.
            const webapp = buildNode('webapp');
            const cache = buildNode('cache');
            const pattern = {
                'properties': {
                    'nodes': {
                        'prefixItems': [webapp],
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        'items': { 'oneOf': {} as any, 'anyOf': [cache] },
                    },
                    'relationships': { 'prefixItems': [] },
                },
            };
            const cacheChoice: CalmChoice = { description: 'Use cache', nodes: ['cache'], relationships: [] };

            expect(() => selectChoices(pattern, [cacheChoice])).not.toThrow();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = selectChoices(pattern, [cacheChoice]) as any;
            expect(result.properties.nodes.prefixItems).toEqual([webapp, cache]);
        });

        it('throws on a malformed prefixItems slot (oneOf: {}) instead of emitting it as a candidate', () => {
            // A slot with a truthy but non-array `oneOf` and no `anyOf` is not a valid
            // choice block. Passing it through unflattened would emit the malformed
            // `{ oneOf: {} }` object itself as a node candidate in generated output.
            const pattern = {
                'properties': {
                    'nodes': {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        'prefixItems': [{ 'oneOf': {} as any }],
                    },
                    'relationships': { 'prefixItems': [] },
                },
            };

            expect(() => selectChoices(pattern, [])).toThrow(/Malformed oneOf\/anyOf block/);
        });

        it('should not affect a normal pattern', () => {
            const applicationA = buildNode('application-a');
            const applicationB = buildNode('application-b');
            const applicationC = buildNode('application-c');
            const connectsRelationshipA = buildConnectsRelationship('application-a-to-c', 'app a to app c', 'application-a', 'application-c');
            const connectsRelationshipB = buildConnectsRelationship('application-b-to-c', 'app b to app c', 'application-b', 'application-c');

            const pattern = buildPattern(
                [ applicationA, applicationB, applicationC ],
                [ connectsRelationshipA, connectsRelationshipB ]
            );

            const expectedPattern = buildPattern(
                [ applicationA, applicationB, applicationC ],
                [ connectsRelationshipA, connectsRelationshipB ]
            );
            expect(selectChoices(pattern, [])).toEqual(expectedPattern);
        });

        it('drops a decision holder entirely when nothing is selected for it, instead of an illegal empty options.prefixItems', () => {
            const applicationA = buildNode('application-a');
            const applicationC = buildNode('application-c');
            const connectsRelationshipA = buildConnectsRelationship('application-a-to-c', 'app a to app c', 'application-a', 'application-c');

            const pattern = buildPattern(
                [applicationA, applicationC],
                [
                    buildPatternOptionRelationship(
                        'cache-choice',
                        'Pick a cache',
                        buildPatternOption('anyOf', buildPatternChoice(applicationAtoC))
                    ),
                    buildPatternOptionRelationship(
                        'queue-choice',
                        'Pick a queue',
                        buildPatternOption('anyOf', buildPatternChoice(applicationBtoC))
                    ),
                    connectsRelationshipA,
                ]
            );

            // Answer cache-choice; leave queue-choice with zero selections - the checkbox
            // (anyOf) case the feature advertises as a legitimate answer.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = selectChoices(pattern, [applicationAtoC]) as any;

            const relationshipIds = result.properties.relationships.prefixItems
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((r: any) => r.properties['unique-id'].const);
            expect(relationshipIds).not.toContain('queue-choice');
            expect(relationshipIds).toContain('cache-choice');

            // An options.prefixItems of length 0 is not a legal JSON Schema (prefixItems
            // must hold at least one entry) - compiling exactly that is what broke
            // `calm validate` on this input before the fix.
            for (const rel of result.properties.relationships.prefixItems) {
                const options = rel.properties?.['relationship-type']?.properties?.options;
                if (options) {
                    expect(options.prefixItems.length).toBeGreaterThan(0);
                }
            }
        });
    });

    describe('allOf pattern support', () => {
        it('should extract options from a pattern with allOf structure', () => {
            const allOfPattern = {
                allOf: [
                    {
                        '$ref': 'https://example.com/base-pattern.json'
                    },
                    {
                        'properties': {
                            'relationships': {
                                'prefixItems': [
                                    buildPatternOptionRelationship(
                                        'option-id',
                                        'Choose connection type',
                                        buildPatternOption('oneOf', buildPatternChoice(applicationAtoC), buildPatternChoice(applicationBtoC))
                                    )
                                ]
                            }
                        }
                    }
                ]
            };

            const expectedOptions: CalmOption[] = [{
                optionType: 'oneOf',
                optionId: 'option-id',
                prompt: 'Choose connection type',
                choices: [applicationAtoC, applicationBtoC]
            }];

            expect(extractOptions(allOfPattern)).toEqual(expectedOptions);
        });

        it('should return empty options when allOf pattern has no relationships', () => {
            const allOfPattern = {
                allOf: [
                    { '$ref': 'https://example.com/base-pattern.json' },
                    { 'properties': { 'nodes': { 'prefixItems': [] } } }
                ]
            };

            expect(extractOptions(allOfPattern)).toEqual([]);
        });

        it('should find relationships in first allOf schema if present there', () => {
            const allOfPattern = {
                allOf: [
                    {
                        'properties': {
                            'relationships': {
                                'prefixItems': [
                                    buildPatternOptionRelationship(
                                        'option-id',
                                        'Choose from base',
                                        buildPatternOption('anyOf', buildPatternChoice(applicationXtoZ), buildPatternChoice(applicationYtoZ))
                                    )
                                ]
                            }
                        }
                    },
                    { '$ref': 'https://example.com/extension.json' }
                ]
            };

            const expectedOptions: CalmOption[] = [{
                optionType: 'anyOf',
                optionId: 'option-id',
                prompt: 'Choose from base',
                choices: [applicationXtoZ, applicationYtoZ]
            }];

            expect(extractOptions(allOfPattern)).toEqual(expectedOptions);
        });
    });

    describe('assertChoicesAreSelectable', () => {
        function choice(description: string, nodes: string[] = [], relationships: string[] = []): CalmChoice {
            return { description, nodes, relationships };
        }

        it('does not throw when every choice names a plain prefixItems candidate', () => {
            const pattern = buildPattern([buildNode('webapp')], []);
            expect(() => assertChoicesAreSelectable(pattern, [choice('pick webapp', ['webapp'])])).not.toThrow();
        });

        it('does not throw when every choice names a reachable items-catalog candidate', () => {
            const pattern = buildPatternWithItemsCatalog([], [buildNode('redis')]);
            expect(() => assertChoicesAreSelectable(pattern, [choice('pick redis', ['redis'])])).not.toThrow();
        });

        it('does not throw when choices is empty', () => {
            const pattern = buildPattern([buildNode('webapp')], []);
            expect(() => assertChoicesAreSelectable(pattern, [])).not.toThrow();
        });

        it('does not throw for a choice naming a reachable prefixItems slot alternative', () => {
            const pattern = buildPattern(
                [{ oneOf: [buildNode('sql-store'), buildNode('nosql-store')] }],
                []
            );
            expect(() => assertChoicesAreSelectable(pattern, [choice('pick sql', ['sql-store'])])).not.toThrow();
        });

        it('throws when a choice names a candidate in the losing keyword of a dual-keyword catalog', () => {
            const pattern = {
                properties: {
                    nodes: {
                        prefixItems: [buildNode('webapp')],
                        items: { oneOf: [buildNode('redis')], anyOf: [buildNode('kafka')] }
                    },
                    relationships: { prefixItems: [] }
                }
            };
            expect(() => assertChoicesAreSelectable(pattern, [choice('pick kafka', ['kafka'])]))
                .toThrow(/node "kafka" \(choice "pick kafka"\)/);
        });

        it('throws when a choice names a node id the pattern does not declare at all', () => {
            const pattern = buildPattern([buildNode('webapp')], []);
            expect(() => assertChoicesAreSelectable(pattern, [choice('typo', ['webbapp'])]))
                .toThrow(/node "webbapp" \(choice "typo"\)/);
        });

        it('throws when a choice names an unreachable relationship candidate', () => {
            const pattern = buildPattern([], [buildConnectsRelationship('r1', 'prompt', 'a', 'b')]);
            expect(() => assertChoicesAreSelectable(pattern, [choice('typo', [], ['ghost'])]))
                .toThrow(/relationship "ghost" \(choice "typo"\)/);
        });
    });
});