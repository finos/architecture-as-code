 

import { CalmChoice, CalmOption, extractOptions, selectChoices } from './options';

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

function buildPatternChoice({description, nodes, relationships}: CalmChoice) {
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
    const option = {};
    option[optionType] = choices;
    return option;
}

function buildNode(uniqueId: string): object {
    return {
        '$ref': 'https://calm.finos.org/draft/2025-03/meta/core.json#/defs/node',
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
        '$ref': 'https://calm.finos.org/draft/2025-03/meta/core.json#/defs/relationship',
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
                    prompt: 'The choice of node A or node B connecting to node C',
                    choices: [applicationAtoC, applicationBtoC]
                },
                {
                    optionType: 'anyOf',
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
    });
});