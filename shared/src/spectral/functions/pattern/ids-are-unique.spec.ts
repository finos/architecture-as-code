import { asContext } from '../spectral-test-helpers';
import idsAreUnique from './ids-are-unique';

describe('idsAreUnique', () => {
    it('should return an empty array when there is no input', () => {
        const input = null;
        const context = {
            document: {
                data: {
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result).toEqual([]);
    });

    it('should return an empty array when there are no duplicate IDs', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'properties': {
                                    'unique-id': { 'const': 'node1' },
                                    'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'intf1' } } }] } }
                                },
                                { 'properties': { 'unique-id': { 'const': 'node2' } } }
                            ]
                        },
                        relationships: {
                            prefixItems: [
                                { 'properties': { 'unique-id': { 'const': 'rel1' } } },
                                { 'properties': { 'unique-id': { 'const': 'rel2' } } }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result).toEqual([]);
    });

    it('should return messages for duplicate IDs within nodes', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'properties': { 'unique-id': { 'const': 'node1' } } },
                                { 'properties': { 'unique-id': { 'const': 'node1' } } }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: node1, path: /properties/nodes/prefixItems/1/properties/unique-id/const');
    });

    it('should return messages for duplicate IDs within relationships', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        relationships: {
                            prefixItems: [
                                { 'properties': { 'unique-id': { 'const': 'rel1' } } },
                                { 'properties': { 'unique-id': { 'const': 'rel1' } } }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: rel1, path: /properties/relationships/prefixItems/1/properties/unique-id/const');
    });


    it('should return messages for duplicate IDs within interfaces', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'properties': {
                                    'unique-id': { 'const': 'node1' },
                                    'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'intf1' } } }] } }
                                },
                                { 'properties': {
                                    'unique-id': { 'const': 'node2' },
                                    'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'intf1' } } }] } }
                                }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: intf1, path: /properties/nodes/prefixItems/1/properties/interfaces/prefixItems/0/properties/unique-id/const');
    });



    it('should return messages for duplicate IDs across unique-ids', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'properties': { 'unique-id': { 'const': 'node1' } } },
                                { 'properties': { 'unique-id': { 'const': 'node2' } } }
                            ]
                        },
                        relationships: {
                            prefixItems: [
                                { 'properties': { 'unique-id': { 'const': 'node1' } } },
                                { 'properties': { 'unique-id': { 'const': 'rel2' } } }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: node1, path: /properties/relationships/prefixItems/0/properties/unique-id/const');
    });

    it('should return an empty array when alternatives in a prefixItems entry have distinct IDs', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'oneOf': [
                                    { 'properties': { 'unique-id': { 'const': 'node1' } } },
                                    { 'properties': { 'unique-id': { 'const': 'node2' } } }
                                ] }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result).toEqual([]);
    });

    it('should return messages for duplicate IDs across oneOf alternatives of a nodes prefixItems entry', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'oneOf': [
                                    { 'properties': { 'unique-id': { 'const': 'node1' } } },
                                    { 'properties': { 'unique-id': { 'const': 'node1' } } }
                                ] }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: node1, path: /properties/nodes/prefixItems/0/oneOf/1/properties/unique-id/const');
    });

    it('should return messages for duplicate IDs across anyOf alternatives of a nodes prefixItems entry', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'anyOf': [
                                    { 'properties': { 'unique-id': { 'const': 'node1' } } },
                                    { 'properties': { 'unique-id': { 'const': 'node1' } } }
                                ] }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: node1, path: /properties/nodes/prefixItems/0/anyOf/1/properties/unique-id/const');
    });

    it('should return messages when an alternative reuses the ID of a mandatory node', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'properties': { 'unique-id': { 'const': 'node1' } } },
                                { 'oneOf': [
                                    { 'properties': { 'unique-id': { 'const': 'node1' } } }
                                ] }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: node1, path: /properties/nodes/prefixItems/1/oneOf/0/properties/unique-id/const');
    });

    it('should return messages for duplicate IDs across oneOf alternatives of a relationships prefixItems entry', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        relationships: {
                            prefixItems: [
                                { 'oneOf': [
                                    { 'properties': { 'unique-id': { 'const': 'rel1' } } },
                                    { 'properties': { 'unique-id': { 'const': 'rel1' } } }
                                ] }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: rel1, path: /properties/relationships/prefixItems/0/oneOf/1/properties/unique-id/const');
    });

    it('should return messages for duplicate IDs across anyOf alternatives of a relationships prefixItems entry', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        relationships: {
                            prefixItems: [
                                { 'anyOf': [
                                    { 'properties': { 'unique-id': { 'const': 'rel1' } } },
                                    { 'properties': { 'unique-id': { 'const': 'rel1' } } }
                                ] }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: rel1, path: /properties/relationships/prefixItems/0/anyOf/1/properties/unique-id/const');
    });

    it('should return messages for duplicate IDs within one node\'s interfaces', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'properties': {
                                    'unique-id': { 'const': 'node1' },
                                    'interfaces': { prefixItems: [
                                        { 'properties': { 'unique-id': { 'const': 'intf1' } } },
                                        { 'properties': { 'unique-id': { 'const': 'intf1' } } }
                                    ] } }
                                }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: intf1, path: /properties/nodes/prefixItems/0/properties/interfaces/prefixItems/1/properties/unique-id/const');
    });

    it('should return an empty array when oneOf alternatives of one entry share an interface ID', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'oneOf': [
                                    { 'properties': {
                                        'unique-id': { 'const': 'postgres' },
                                        'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'db-port' } } }] } }
                                    },
                                    { 'properties': {
                                        'unique-id': { 'const': 'mysql' },
                                        'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'db-port' } } }] } }
                                    }
                                ] }
                            ]
                        }
                    }
                }
            }
        };

        expect(idsAreUnique(input, null, asContext(context))).toEqual([]);
    });

    it('should return an empty array when anyOf alternatives of one entry share an interface ID', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'anyOf': [
                                    { 'properties': {
                                        'unique-id': { 'const': 'postgres' },
                                        'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'db-port' } } }] } }
                                    },
                                    { 'properties': {
                                        'unique-id': { 'const': 'mysql' },
                                        'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'db-port' } } }] } }
                                    }
                                ] }
                            ]
                        }
                    }
                }
            }
        };

        expect(idsAreUnique(input, null, asContext(context))).toEqual([]);
    });

    it('should return messages for duplicate interface IDs on alternatives of different entries', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'oneOf': [
                                    { 'properties': {
                                        'unique-id': { 'const': 'node1' },
                                        'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'intf1' } } }] } }
                                    }
                                ] },
                                { 'oneOf': [
                                    { 'properties': {
                                        'unique-id': { 'const': 'node2' },
                                        'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'intf1' } } }] } }
                                    }
                                ] }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: intf1, path: /properties/nodes/prefixItems/1/oneOf/0/properties/interfaces/prefixItems/0/properties/unique-id/const');
    });

    it('should return messages when an entry and its own alternative share an interface ID', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                {
                                    'properties': {
                                        'unique-id': { 'const': 'base' },
                                        'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'intf1' } } }] } },
                                    'oneOf': [
                                        { 'properties': {
                                            'unique-id': { 'const': 'alt' },
                                            'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'intf1' } } }] } }
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: intf1, path: /properties/nodes/prefixItems/0/oneOf/0/properties/interfaces/prefixItems/0/properties/unique-id/const');
    });

    it('should return an empty array when an entry and its own alternative have distinct interface IDs', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                {
                                    'properties': {
                                        'unique-id': { 'const': 'base' },
                                        'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'intf1' } } }] } },
                                    'oneOf': [
                                        { 'properties': {
                                            'unique-id': { 'const': 'alt' },
                                            'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'intf2' } } }] } }
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        };

        expect(idsAreUnique(input, null, asContext(context))).toEqual([]);
    });

    it('should return messages when an alternative reuses the interface ID of a mandatory node', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'properties': {
                                    'unique-id': { 'const': 'webapp' },
                                    'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'intf1' } } }] } }
                                },
                                { 'oneOf': [
                                    { 'properties': {
                                        'unique-id': { 'const': 'cache' },
                                        'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'intf1' } } }] } }
                                    }
                                ] }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: intf1, path: /properties/nodes/prefixItems/1/oneOf/0/properties/interfaces/prefixItems/0/properties/unique-id/const');
    });
    it('should blame the later declaration when an alternative comes before a fixed entry', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'oneOf': [{ 'properties': { 'unique-id': { 'const': 'dup' } } }] },
                                { 'properties': { 'unique-id': { 'const': 'dup' } } }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result[0].message).toContain('path: /properties/nodes/prefixItems/1/properties/unique-id/const');
    });

    it('should blame the later declaration when anyOf comes before oneOf', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'anyOf': [{ 'properties': { 'unique-id': { 'const': 'dup' } } }] },
                                { 'oneOf': [{ 'properties': { 'unique-id': { 'const': 'dup' } } }] }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result[0].message).toContain('path: /properties/nodes/prefixItems/1/oneOf/0/properties/unique-id/const');
    });

    it('should order prefixItems entries numerically, not as strings', () => {
        const input = {};
        const prefixItems = Array.from({ length: 11 }, (_, index) => ({ 'properties': { 'unique-id': { 'const': `n${index}` } } }));
        prefixItems.push({ 'properties': { 'unique-id': { 'const': 'n2' } } });
        const context = { document: { data: { properties: { nodes: { prefixItems } } } } };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result[0].message).toContain('path: /properties/nodes/prefixItems/11/properties/unique-id/const');
    });
    it('should blame the items member when a fixed entry declares the same id', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [{ 'properties': { 'unique-id': { 'const': 'dup' } } }],
                            items: { 'oneOf': [{ 'properties': { 'unique-id': { 'const': 'dup' } } }] }
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result[0].message).toContain('path: /properties/nodes/items/oneOf/0/properties/unique-id/const');
    });

    it('should blame the items member however the pattern orders its keys', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            items: { 'oneOf': [{ 'properties': { 'unique-id': { 'const': 'dup' } } }] },
                            prefixItems: [{ 'properties': { 'unique-id': { 'const': 'dup' } } }]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result[0].message).toContain('path: /properties/nodes/items/oneOf/0/properties/unique-id/const');
    });

    it('should blame the items member for an interface id a fixed node already declares', () => {
        const input = {};
        const withPort = (id: string) => ({ 'properties': {
            'unique-id': { 'const': id },
            'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'port' } } }] } } });
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: { prefixItems: [withPort('database')], items: { 'oneOf': [withPort('cache')] } }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result[0].message).toContain('path: /properties/nodes/items/oneOf/0/properties/interfaces/prefixItems/0/properties/unique-id/const');
    });
});
