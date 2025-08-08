import { CalmCoreSchema } from '../types/core-types.js';
import { CalmCore } from './core.js';
import {ResolvableAndAdaptable} from './resolvable';

describe('CalmCore', () => {
    it('should create from minimal schema', () => {
        const minimalSchema: CalmCoreSchema = {
            nodes: [],
            relationships: []
        };
        const core = CalmCore.fromSchema(minimalSchema);
        expect(core).toBeInstanceOf(CalmCore);
        expect(core.nodes).toEqual([]);
        expect(core.relationships).toEqual([]);
        expect(core.controls).toBeUndefined();
        expect(core.flows).toBeUndefined();
        expect(core.metadata).toBeUndefined();
        expect(core.adrs).toBeUndefined();
    });

    it('should create from single node and relationship (realistic)', () => {
        const schema: CalmCoreSchema = {
            nodes: [
                {
                    'unique-id': 'frontend',
                    'name': 'Frontend Web App',
                    'description': 'User-facing web application',
                    'node-type': 'webclient',
                    'interfaces': [
                        {
                            'unique-id': 'frontend-url',
                            'url': 'https://myapp.example.com'
                        }
                    ]
                }
            ],
            relationships: [
                {
                    'unique-id': 'frontend-backend',
                    'description': 'Frontend calls backend API',
                    'protocol': 'HTTPS',
                    'relationship-type': {
                        'connects': {
                            'source': {
                                'node': 'frontend'
                            },
                            'destination': {
                                'node': 'backend'
                            }
                        }
                    }
                }
            ]
        };
        const core = CalmCore.fromSchema(schema);
        expect(core.nodes.length).toBe(1);
        expect(core.relationships.length).toBe(1);
        expect(core.nodes[0].uniqueId).toBe('frontend');
        expect(core.relationships[0].uniqueId).toBe('frontend-backend');
    });

    it('should create from partial schema (only nodes)', () => {
        const schema: CalmCoreSchema = {
            nodes: [
                {
                    'unique-id': 'backend',
                    'name': 'Backend Service',
                    'description': 'Handles business logic and data',
                    'node-type': 'service',
                    'interfaces': [
                        {
                            'unique-id': 'backend-api',
                            'host': 'backend.internal',
                            'port': 8080
                        }
                    ]
                }
            ]
        };
        const core = CalmCore.fromSchema(schema);
        expect(core.nodes.length).toBe(1);
        expect(core.relationships).toEqual([]);
        expect(core.nodes[0].uniqueId).toBe('backend');
    });

    it('should produce the correct canonical model (minimal)', () => {
        const minimalSchema: CalmCoreSchema = {
            nodes: [],
            relationships: []
        };
        const core = CalmCore.fromSchema(minimalSchema);
        expect(core.toCanonicalSchema()).toEqual({
            nodes: [],
            relationships: [],
            controls: undefined,
            flows: undefined,
            metadata: undefined,
            adrs: undefined
        });
    });

    it('should produce the correct canonical model (full, realistic)', () => {
        const schema: CalmCoreSchema = {
            nodes: [
                {
                    'unique-id': 'frontend',
                    'name': 'Frontend Web App',
                    'description': 'User-facing web application',
                    'node-type': 'webclient',
                    'interfaces': [
                        {
                            'unique-id': 'frontend-url',
                            'url': 'https://myapp.example.com'
                        }
                    ]
                },
                {
                    'unique-id': 'backend',
                    'name': 'Backend Service',
                    'description': 'Handles business logic and data',
                    'node-type': 'service',
                    'interfaces': [
                        {
                            'unique-id': 'backend-api',
                            'host': 'backend.internal',
                            'port': 8080
                        }
                    ],
                    'controls': {
                        'auth': {
                            'description': 'Authentication required',
                            'requirements': [
                                {
                                    'requirement-url': 'https://example.com/controls/auth.requirement.json',
                                    'config-url': 'https://example.com/controls/auth.config.json'
                                }
                            ]
                        }
                    }
                }
            ],
            relationships: [
                {
                    'unique-id': 'frontend-backend',
                    'description': 'Frontend calls backend API',
                    'protocol': 'HTTPS',
                    'relationship-type': {
                        'connects': {
                            'source': {
                                'node': 'frontend'
                            },
                            'destination': {
                                'node': 'backend'
                            }
                        }
                    },
                    'controls': {
                        'auth': {
                            'description': 'API authentication',
                            'requirements': [
                                {
                                    'requirement-url': 'https://example.com/controls/api-auth.requirement.json',
                                    'config-url': 'https://example.com/controls/api-auth.config.json'
                                }
                            ]
                        }
                    }
                }
            ],
            metadata: [
                {
                    'environment': 'test'
                }
            ],
            flows: [
                {
                    'unique-id': 'flow-1',
                    'name': 'User Login Flow',
                    'description': 'User logs in via frontend, backend validates',
                    'transitions': [
                        {
                            'relationship-unique-id': 'frontend-backend',
                            'sequence-number': 1,
                            'description': 'Frontend sends login request to backend'
                        }
                    ]
                }
            ],
            adrs: ['adr-1']
        };
        const core = CalmCore.fromSchema(schema);
        const canonical = core.toCanonicalSchema();
        expect(canonical.nodes[0]['unique-id']).toBe('frontend');
        expect(canonical.relationships[0]['unique-id']).toBe('frontend-backend');
        expect(canonical.controls).toBeUndefined(); // Only node/relationship controls present
        expect(canonical.flows?.[0]['unique-id']).toBe('flow-1');
        expect(canonical.metadata).toBeDefined();
        expect(canonical.adrs).toEqual(['adr-1']);
    });

    it('should return the original schema with toSchema()', () => {
        const schema: CalmCoreSchema = {
            nodes: [
                {
                    'unique-id': 'frontend',
                    'name': 'Frontend Web App',
                    'description': 'User-facing web application',
                    'node-type': 'webclient'
                }
            ],
            relationships: []
        };
        const core = CalmCore.fromSchema(schema);
        expect(core.toSchema()).toEqual(schema);
    });

    it('should handle empty arrays for nodes, relationships, flows, adrs', () => {
        const schema: CalmCoreSchema = {
            nodes: [],
            relationships: [],
            flows: [],
            adrs: []
        };
        const core = CalmCore.fromSchema(schema);
        expect(core.nodes).toEqual([]);
        expect(core.relationships).toEqual([]);
        expect(core.flows).toEqual([]);
        expect(core.adrs).toEqual([]);
        expect(core.toCanonicalSchema().nodes).toEqual([]);
        expect(core.toCanonicalSchema().relationships).toEqual([]);
        expect(core.toCanonicalSchema().flows).toEqual([]);
        expect(core.toCanonicalSchema().adrs).toEqual([]);
    });

    it('should not allow additional properties in schema model', () => {
        const schema: CalmCoreSchema = {
            nodes: [
                {
                    'unique-id': 'frontend',
                    'name': 'Frontend Web App',
                    'description': 'User-facing web application',
                    'node-type': 'webclient'
                }
            ],
            relationships: []
        };
        const core = CalmCore.fromSchema(schema);
        // It's currently allowed on schema, but we have not added to type definition or model.
        // See https://github.com/finos/architecture-as-code/issues/1476 which aims to ban completely
        expect(core.originalJson['extra-info']).toBeUndefined();


    });

    it('should support nested CalmCore in node details', () => {
        const schema: CalmCoreSchema = {
            nodes: [
                {
                    'unique-id': 'backend',
                    'name': 'Backend Service',
                    'description': 'Handles business logic and data',
                    'node-type': 'service',
                    'details': {
                        'required-pattern': 'pattern-1',
                        'detailed-architecture': 'nested-arch'
                    }
                }
            ],
            relationships: []
        };
        const core = CalmCore.fromSchema(schema);
        // Simulate resolved detailedArchitecture with an inner CalmCore
        const node = core.nodes[0];
        if (node.details && node.details.detailedArchitecture) {
            node.details.detailedArchitecture = new ResolvableAndAdaptable(
                'fake-url',
                CalmCore.fromSchema,
                CalmCore.fromSchema({
                    nodes: [
                        { 'unique-id': 'inner-node', 'node-type': 'service', 'name': 'Inner', 'description': 'Inner node' }
                    ],
                    relationships: []
                })
            );
        }
        const { details } = node.toCanonicalSchema();
        expect(JSON.parse(JSON.stringify(details))).toEqual({
            nodes: [
                {
                    'unique-id': 'inner-node',
                    'node-type': 'service',
                    'name': 'Inner',
                    'description': 'Inner node'
                }
            ],
            relationships: []
        });


    });

    it('should collapse details if detailed-architecture is resolved', () => {
        const schema: CalmCoreSchema = {
            nodes: [
                {
                    'unique-id': 'backend',
                    'name': 'Backend Service',
                    'description': 'Handles business logic and data',
                    'node-type': 'service',
                    'details': {
                        'required-pattern': 'pattern-1',
                        'detailed-architecture': 'nested-arch'
                    }
                }
            ],
            relationships: []
        };
        const core = CalmCore.fromSchema(schema);
        // Simulate resolved detailedArchitecture with an inner CalmCore
        const node = core.nodes[0];
        if (node.details && node.details.detailedArchitecture) {
            node.details.detailedArchitecture = new ResolvableAndAdaptable(
                'fake-url',
                CalmCore.fromSchema,
                CalmCore.fromSchema({
                    nodes: [
                        { 'unique-id': 'inner-node', 'node-type': 'service', 'name': 'Inner', 'description': 'Inner node' }
                    ],
                    relationships: []
                })
            );
        }
        expect(core.toCanonicalSchema().nodes[0].details).toEqual({
            nodes: [
                { 'unique-id': 'inner-node', 'node-type': 'service', 'name': 'Inner', 'description': 'Inner node' }
            ],
            relationships: []
        });
    });

    it('should collapse config on controls at top level', () => {
        const schema: CalmCoreSchema = {
            nodes: [
                {
                    'unique-id': 'backend',
                    'name': 'Backend Service',
                    'description': 'Handles business logic and data',
                    'node-type': 'service',
                    'controls': {
                        'auth': {
                            'description': 'Authentication required',
                            'requirements': [
                                {
                                    'requirement-url': 'https://example.com/controls/auth.requirement.json',
                                    'config': {
                                        'username': 'admin',
                                        'password': 'secret'
                                    }
                                }
                            ]
                        }
                    }
                }
            ],
            relationships: []
        };
        const core = CalmCore.fromSchema(schema);
        const canonical = core.toCanonicalSchema();
        expect(canonical.nodes[0].controls.auth.requirements[0]).toEqual({
            'requirement-url': 'https://example.com/controls/auth.requirement.json',
            username: 'admin',
            password: 'secret'
        });
    });

    it('should not include config in interface definition canonical', () => {
        const schema: CalmCoreSchema = {
            nodes: [
                {
                    'unique-id': 'frontend',
                    'name': 'Frontend Web App',
                    'description': 'User-facing web application',
                    'node-type': 'webclient',
                    'interfaces': [
                        {
                            'unique-id': 'frontend-url',
                            'definition-url': 'https://example.com/interfaces/http.json',
                            'config': { 'url': 'https://myapp.example.com' }
                        }
                    ]
                }
            ],
            relationships: []
        };
        const core = CalmCore.fromSchema(schema);
        const canonical = core.toCanonicalSchema();
        expect(canonical.nodes[0].interfaces[0]).toEqual({
            'unique-id': 'frontend-url',
            'definition-url': 'https://example.com/interfaces/http.json',
            'url': 'https://myapp.example.com'
        });
    });


});
