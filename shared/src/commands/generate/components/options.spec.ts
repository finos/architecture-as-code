 

import { CalmNode, CalmNodeDetails } from '@finos/calm-shared/model/node';
import { CalmChoice, CalmOption, optionsFor, selectChoices } from './options';
import { CalmMetadata } from '@finos/calm-shared/model/metadata';
import { CalmRelationship } from '@finos/calm-shared/model/relationship';

jest.mock('winston', () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn().mockImplementation((err) => console.log(err)),
    warn: jest.fn(),
    format: {
        colorize: jest.fn(),
        combine: jest.fn(),
        label: jest.fn(),
        timestamp: jest.fn(),
        printf: jest.fn(),
        cli: jest.fn(),
        errors: jest.fn()
    },
    createLogger: jest.fn().mockReturnValue({
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn().mockImplementation((err) => console.log(err)),
        warn: jest.fn(),
    }),
    transports: {
        Console: jest.fn()
    }
}));

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

function buildNode(node: CalmNode): object {
    return {
        '$ref': 'https://calm.finos.org/draft/2025-03/meta/core.json#/defs/node',
        'type': 'object',
        'properties': {
            'unique-id': {
                'const': node.uniqueId
            },
            'name': {
                'const': node.name
            },
            'description': {
                'const': node.description
            },
            'node-type': {
                'const': node.nodeType
            }
        }
    };
}

function buildRelationship(relationship: CalmRelationship): object {
    return {
        '$ref': 'https://calm.finos.org/draft/2025-03/meta/core.json#/defs/relationship',
        'type': 'object',
        'properties': {
            'unique-id': {
                'const': relationship.uniqueId
            },
            'description': {
                'const': relationship.description
            },
            'relationship-type': relationship.relationshipType{
                'const': {
                    'connects': {
                        'source': { 'node': 'application-c' },
                        'destination': { 'node': 'node-1' }
                    }
                }
            }
        }
    };
}

function buildPatternOptionRelationship(prompt: string, ...options: object[]): object {
    return {
        'properties': {
            'description': {
                'const': prompt
            },
            'relationship-type': {
                'options': {
                    'prefixItems': options
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
                [buildPatternOptionRelationship(
                    'The choice of nodes and relationships in the pattern', 
                    buildPatternOption('oneOf', buildPatternChoice(applicationAtoC), buildPatternChoice(applicationBtoC))
                )]
            );

            const expectedOptions: CalmOption[] = [{
                optionType: 'oneOf',
                prompt: 'The choice of nodes and relationships in the pattern',
                choices: [applicationAtoC, applicationBtoC]
            }];

            expect(optionsFor(pattern)).toEqual(expectedOptions);
        });

        it('should return an anyOf option from a spec', () => {
            const pattern = buildPattern(
                [],
                [buildPatternOptionRelationship(
                    'The choice of nodes and relationships in the pattern', 
                    buildPatternOption('anyOf', buildPatternChoice(applicationAtoC), buildPatternChoice(applicationBtoC))
                )]
            );

            const expectedOptions: CalmOption[] = [{
                optionType: 'anyOf',
                prompt: 'The choice of nodes and relationships in the pattern',
                choices: [applicationAtoC, applicationBtoC]
            }];

            expect(optionsFor(pattern)).toEqual(expectedOptions);
        });

        it('should return no options from a spec that contains no options relationship', () => {
            const patternWithNoRelationships = {
                'properties': {
                    'relationships': {
                        'prefixItems': []
                    }
                }
            };

            expect(optionsFor(patternWithNoRelationships)).toEqual([]);
        });

        it('should return multiple options from a spec', () => {
            const pattern = buildPattern(
                [],
                [
                    buildPatternOptionRelationship(
                        'The choice of node A or node B connecting to node C',
                        buildPatternOption('oneOf', buildPatternChoice(applicationAtoC), buildPatternChoice(applicationBtoC))
                    ),
                    buildPatternOptionRelationship(
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

            expect(optionsFor(pattern)).toEqual(expectedOptions);
        });
    });

    describe('selectChoices', () => {
        it('should remove items not selected from pattern', () => {
            const node = buildNode(new CalmNode(
                'node-1',
                'service',
                'Node 1',
                'This is node 1',
                new CalmNodeDetails('', ''),
                [],
                [],
                new CalmMetadata({}),
            ));
            
            const pattern = buildPattern(
                [node],
                [buildPatternOptionRelationship(
                    'The choice of nodes and relationships in the pattern', 
                    buildPatternOption('anyOf', buildPatternChoice(applicationAtoC), buildPatternChoice(applicationBtoC))
                )]
            );

            const expectedPattern = buildPattern();
            expect(selectChoices(pattern, choices)).toEqual(expectedPattern);
        });
    });
});