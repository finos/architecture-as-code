import { describe, expect, it } from "vitest";
import { convertCalmPatternToCalm, isCalmPatternSchema } from "./calm-pattern-to-cytoscape-converter.js";
import { CalmPatternSchema } from "../contracts/calm-pattern-contracts.js";

describe('isCalmPatternSchema', () => {
    it('should return true for a valid CalmPatternSchema', () => {
        const validPattern = {
            type: "object",
            title: "Sample Pattern",
            required: ["nodes", "relationships"],
            properties: {
                nodes: {
                    prefixItems: []
                },
                relationships: {
                    prefixItems: []
                }
            }
        };
        expect(isCalmPatternSchema(validPattern)).toBe(true);
    });

    it('should return false when the type property is missing', () => {
        const invalidPattern = {
            title: "Sample Pattern",
            required: ["nodes", "relationships"],
            properties: {
                nodes: {
                    prefixItems: []
                },
                relationships: {
                    prefixItems: []
                }
            }
        };
        expect(isCalmPatternSchema(invalidPattern)).toBe(false);
    });

    it('should return false when the title property is missing', () => {
        const invalidPattern = {
            type: "object",
            required: ["nodes", "relationships"],
            properties: {
                nodes: {
                    prefixItems: []
                },
                relationships: {
                    prefixItems: []
                }
            }
        };
        expect(isCalmPatternSchema(invalidPattern)).toBe(false);
    });

    it('should return false when the required property is not an array', () => {
        const invalidPattern = {
            type: "object",
            title: "Sample Pattern",
            required: "nodes, relationships",
            properties: {
                nodes: {
                    prefixItems: []
                },
                relationships: {
                    prefixItems: []
                }
            }
        };
        expect(isCalmPatternSchema(invalidPattern)).toBe(false);
    });

    it('should return false when the nodes property is missing', () => {
        const invalidPattern = {
            type: 'object',
            title: 'Sample Pattern',
            required: ['nodes', 'relationships'],
            properties: {
                relationships: {
                    prefixItems: []
                }
            }
        };
        expect(isCalmPatternSchema(invalidPattern)).toBe(false);
    });

    it('should return false when the relationships property is missing', () => {
        const invalidPattern = {
            type: 'object',
            title: 'Sample Pattern',
            required: ['nodes', 'relationships'],
            properties: {
                nodes: {
                    prefixItems: []
                }
            }
        };
        expect(isCalmPatternSchema(invalidPattern)).toBe(false);
    });

    describe('convertCalmPatternToCalm', () => {
        it('should default an undefined pattern correctly', () => {
            expect(convertCalmPatternToCalm(undefined)).toEqual({
                nodes: undefined,
                relationships: undefined,
                metadata: undefined,
                controls: undefined,
            });
        });

        it('should map nodes correctly', () => {
            const calmPattern = {
                properties: {
                    nodes: {
                        prefixItems: [
                            {
                                type: 'object',
                                properties: {
                                    'unique-id': {
                                        const: 'attendees'
                                    },
                                    name: {
                                        const: 'Attendees Service'
                                    },
                                    description: {
                                        const: 'The attendees service, or a placeholder for another application'
                                    },
                                    'node-type': {
                                        const: 'service'
                                    },
                                    'interfaces': {
                                        type: 'array',
                                        minItems: 2,
                                        maxItems: 2,
                                        prefixItems: [
                                            {
                                                properties: {
                                                    'unique-id': {
                                                        const: 'attendees-image'
                                                    }
                                                }
                                            },
                                            {
                                                properties: {
                                                    'unique-id': {
                                                        const: 'attendees-port'
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                }
                            },
                            {
                                type: 'object',
                                properties: {
                                    'unique-id': {
                                        const: 'k8s-cluster'
                                    },
                                    name: {
                                        const: 'Kubernetes Cluster'
                                    },
                                    description: {
                                        const: 'Kubernetes Cluster with network policy rules enabled'
                                    },
                                    'node-type': {
                                        const: 'system'
                                    },
                                    controls: {
                                        properties: {
                                            security: {
                                                type: 'object',
                                                properties: {
                                                    description: {
                                                        const: 'Security requirements for the Kubernetes cluster'
                                                    },
                                                    requirements: {
                                                        type: 'array',
                                                        minItems: 1,
                                                        maxItems: 1,
                                                        prefixItems: [
                                                            {
                                                                properties: {
                                                                    'requirement-url': {
                                                                        const: 'https://calm.finos.org/getting-started/controls/micro-segmentation.requirement.json'
                                                                    },
                                                                    'config-url': {
                                                                        const: 'https://calm.finos.org/getting-started/controls/micro-segmentation.config.json'
                                                                    }
                                                                }
                                                            }
                                                        ]
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        ]
                    },
                    relationships: {
                        prefixItems: []
                    }
                }
            };
            const calmArchitecture = convertCalmPatternToCalm(calmPattern as unknown as CalmPatternSchema);
            expect(calmArchitecture.nodes).toHaveLength(2);
            expect(calmArchitecture.nodes?.[0]).toEqual({
                controls: undefined,
                description: 'The attendees service, or a placeholder for another application',
                'interfaces': [
                    {
                        'unique-id': 'attendees-image',
                    },
                    {
                        'unique-id': 'attendees-port',
                    },
                ],
                name: 'Attendees Service',
                'node-type': 'service',
                'unique-id': 'attendees',
            });
            expect(calmArchitecture.nodes?.[1]).toEqual({
                controls: {
                    security: {
                        description: 'Security requirements for the Kubernetes cluster',
                        requirements: [
                            {
                                'config-url': 'https://calm.finos.org/getting-started/controls/micro-segmentation.config.json',
                                'requirement-url': 'https://calm.finos.org/getting-started/controls/micro-segmentation.requirement.json',
                            },
                        ],
                    },
                },
                description: 'Kubernetes Cluster with network policy rules enabled',
                interfaces: undefined,
                name: 'Kubernetes Cluster',
                'node-type': 'system',
                'unique-id': 'k8s-cluster',
            });
        });

        it('should map relationships correctly', () => {
            const calmPattern = {
                properties: {
                    nodes: {
                        prefixItems: []
                    },
                    relationships: {
                        prefixItems: [
                            {
                                type: 'object',
                                properties: {
                                    'unique-id': {
                                        const: 'load-balancer-attendees'
                                    },
                                    description: {
                                        const: 'Forward'
                                    },
                                    protocol: {
                                        const: 'mTLS'
                                    },
                                    'relationship-type': {
                                        const: {
                                            connects: {
                                                source: {
                                                    node: 'load-balancer'
                                                },
                                                destination: {
                                                    node: 'attendees'
                                                }
                                            }
                                        }
                                    },
                                    controls: {
                                        properties: {
                                            security: {
                                                type: 'object',
                                                properties: {
                                                    description: {
                                                        const: 'Security Controls for the connection'
                                                    },
                                                    requirements: {
                                                        type: 'array',
                                                        minItems: 1,
                                                        maxItems: 1,
                                                        prefixItems: [
                                                            {
                                                                properties: {
                                                                    'requirement-url': {
                                                                        const: 'https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json'
                                                                    },
                                                                    'config-url': {
                                                                        const: 'https://calm.finos.org/getting-started/controls/permitted-connection-http.config.json'
                                                                    }
                                                                },
                                                                required: [
                                                                    'config-url'
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                "required": [
                                    "description"
                                ]
                            },
                            {
                                properties: {
                                    'unique-id': {
                                        const: 'deployed-in-k8s-cluster'
                                    },
                                    description: {
                                        const: 'Components deployed on the k8s cluster'
                                    },
                                    'relationship-type': {
                                        const: {
                                            'deployed-in': {
                                                container: 'k8s-cluster',
                                                nodes: [
                                                    'load-balancer',
                                                    'attendees',
                                                    'attendees-store'
                                                ]
                                            }
                                        }
                                    }
                                },
                                required: [
                                    'description'
                                ]
                            }
                        ]
                    }
                }
            };
            const calmArchitecture = convertCalmPatternToCalm(calmPattern as unknown as CalmPatternSchema);
            expect(calmArchitecture.relationships).toHaveLength(2);
            expect(calmArchitecture.relationships?.[0]).toEqual({
                controls: {
                    security: {
                        description: 'Security Controls for the connection',
                        requirements: [
                            {
                                'config-url': 'https://calm.finos.org/getting-started/controls/permitted-connection-http.config.json',
                                'requirement-url': 'https://calm.finos.org/getting-started/controls/permitted-connection.requirement.json',
                            },
                        ],
                    },
                },
                description: 'Forward',
                protocol: 'mTLS',
                'relationship-type': {
                    connects: {
                        destination: {
                            node: 'attendees',
                        },
                        source: {
                            node: 'load-balancer',
                        },
                    },
                },
                'unique-id': 'load-balancer-attendees',
            });
            expect(calmArchitecture.relationships?.[1]).toEqual({
                controls: undefined,
                description: 'Components deployed on the k8s cluster',
                protocol: undefined,
                'relationship-type': {
                    'deployed-in': {
                        container: 'k8s-cluster',
                        nodes: [
                            'load-balancer',
                            'attendees',
                            'attendees-store',
                        ],
                    },
                },
                'unique-id': 'deployed-in-k8s-cluster',
            }
            );
        });

        it('should map metadata correctly', () => {
            const calmPattern = {
                properties: {
                    nodes: {
                        prefixItems: []
                    },
                    relationships: {
                        prefixItems: []
                    },
                    metadata: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 1,
                        prefixItems: [{
                            type: 'object',
                            properties: {
                                kubernetes: {
                                    type: 'object',
                                    properties: {
                                        namespace: {
                                            const: 'conference'
                                        }
                                    },
                                    required: [
                                        'namespace'
                                    ]
                                }
                            },
                            required: [
                                'kubernetes'
                            ]
                        }]

                    }
                }
            };
            const calmArchitecture = convertCalmPatternToCalm(calmPattern as unknown as CalmPatternSchema);
            expect(calmArchitecture.metadata).toEqual([
                {
                    kubernetes: {
                        namespace: 'conference'
                    }
                }
            ]);
        });

        it('should map controls correctly', () => {
            const calmPattern = {
                properties: {
                    nodes: {
                        prefixItems: []
                    },
                    relationships: {
                        prefixItems: []
                    },
                    controls: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 1,
                        prefixItems: [{
                            type: 'object',
                            properties: {
                                governance: {
                                    type: 'object',
                                    properties: {
                                        description: {
                                            const: 'Governance controls for the architecture'
                                        }
                                    },
                                    required: [
                                        'description'
                                    ]
                                }
                            },
                            required: [
                                'governance'
                            ]
                        }]
                    }
                }
            };
            const calmArchitecture = convertCalmPatternToCalm(calmPattern as unknown as CalmPatternSchema);
            expect(calmArchitecture.controls).toEqual([
                {
                    governance: {
                        description: 'Governance controls for the architecture'
                    }
                }
            ]);
        });

        it('should handle oneOf structures correctly', () => {
            const calmPattern = {
                title: "Application A/B/C + Database Pattern",
                type: "object",
                properties: {
                    nodes: {
                        type: "array",
                        minItems: 3,
                        maxItems: 3,
                        prefixItems: [
                            {
                                oneOf: [
                                    {
                                        type: "object",
                                        properties: {
                                            'unique-id': {
                                                const: "application-a"
                                            },
                                            name: {
                                                const: "Application A"
                                            },
                                            description: {
                                                const: "Application A, optionally used in this architecture"
                                            },
                                            'node-type': {
                                                const: "service"
                                            }
                                        }
                                    },
                                    {
                                        type: "object",
                                        properties: {
                                            'unique-id': {
                                                const: "application-b"
                                            },
                                            name: {
                                                const: "Application B"
                                            },
                                            description: {
                                                const: "Application B, optionally used in this architecture"
                                            },
                                            'node-type': {
                                                const: "service"
                                            }
                                        }
                                    }
                                ]
                            },
                        ]
                    },
                    "relationships": {
                        type: "array",
                        minItems: 3,
                        maxItems: 3,
                        prefixItems: [
                            {
                                oneOf: [
                                    {
                                        type: "object",
                                        properties: {
                                            'unique-id': {
                                                const: "application-a-to-c"
                                            },
                                            description: {
                                                const: "Application A connects to Application C"
                                            },
                                            'relationship-type': {
                                                const: {
                                                    connects: {
                                                        source: { node: "application-a" },
                                                        destination: { node: "application-c" }
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    {
                                        type: "object",
                                        properties: {
                                            'unique-id': {
                                                const: "application-b-to-c"
                                            },
                                            description: {
                                                const: "Application B connects to Application C"
                                            },
                                            'relationship-type': {
                                                const: {
                                                    connects: {
                                                        source: { node: "application-b" },
                                                        destination: { node: "application-c" }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                },
                required: [
                    "nodes",
                    "relationships"
                ]
            };
            const calmArchitecture = convertCalmPatternToCalm(calmPattern);
            expect(calmArchitecture.nodes).toHaveLength(1);
            expect(calmArchitecture.nodes?.[0]).toEqual({
                'unique-id': 'application-a',
                name: 'Application A',
                description: 'Application A, optionally used in this architecture',
                'node-type': 'service',
            });
            expect(calmArchitecture.relationships).toHaveLength(1);
            expect(calmArchitecture.relationships?.[0]).toEqual({
                'unique-id': 'application-a-to-c',
                description: 'Application A connects to Application C',
                'relationship-type': {
                    connects: {
                        source: { node: 'application-a' },
                        destination: { node: 'application-c' },
                    },
                },
            });
        });

        it('should handle anyOf structures correctly', () => {
            const calmPattern = {
                title: "Application + Database A and/or B Pattern",
                type: "object",
                properties: {
                    nodes: {
                        type: "array",
                        minItems: 1,
                        maxItems: 3,
                        prefixItems: [
                            {
                                anyOf: [
                                    {
                                        type: "object",
                                        properties: {
                                            'unique-id': {
                                                const: "database-a"
                                            },
                                            name: {
                                                const: "Database A"
                                            },
                                            description: {
                                                const: "Database A, optionally used in this architecture"
                                            },
                                            'node-type': {
                                                const: "database"
                                            }
                                        }
                                    },
                                    {
                                        type: "object",
                                        properties: {
                                            'unique-id': {
                                                const: "database-b"
                                            },
                                            name: {
                                                const: "Database B"
                                            },
                                            description: {
                                                const: "Database B, optionally used in this architecture"
                                            },
                                            'node-type': {
                                                const: "database"
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    },
                    relationships: {
                        type: "array",
                        minItems: 1,
                        maxItems: 3,
                        prefixItems: [
                            {
                                anyOf: [
                                    {
                                        type: "object",
                                        properties: {
                                            'unique-id': {
                                                const: "application-database-a"
                                            },
                                            description: {
                                                const: "Application connects to Database A"
                                            },
                                            'relationship-type': {
                                                const: {
                                                    connects: {
                                                        source: { node: "application" },
                                                        destination: { node: "database-a" }
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    {
                                        type: "object",
                                        properties: {
                                            'unique-id': {
                                                const: "application-database-b"
                                            },
                                            description: {
                                                const: "Application connects to Database B"
                                            },
                                            'relationship-type': {
                                                const: {
                                                    connects: {
                                                        source: { node: "application" },
                                                        destination: { node: "database-b" }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                },
                required: [
                    "nodes",
                    "relationships"
                ]
            }

            const calmArchitecture = convertCalmPatternToCalm(calmPattern);
            expect(calmArchitecture.nodes).toHaveLength(1);
            expect(calmArchitecture.nodes?.[0]).toEqual({
                'unique-id': 'database-a',
                name: 'Database A',
                description: 'Database A, optionally used in this architecture',
                'node-type': 'database',
            });
            expect(calmArchitecture.relationships).toHaveLength(1);
            expect(calmArchitecture.relationships?.[0]).toEqual({
                'unique-id': 'application-database-a',
                description: 'Application connects to Database A',
                'relationship-type': {
                    connects: {
                        source: { node: 'application' },
                        destination: { node: 'database-a' }
                    },
                },
            });
        });
    });
});