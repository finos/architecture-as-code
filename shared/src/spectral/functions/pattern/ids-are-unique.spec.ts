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

    it('should return messages for duplicate interface IDs on oneOf alternatives', () => {
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
                                    },
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
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: intf1, path: /properties/nodes/prefixItems/0/oneOf/1/properties/interfaces/prefixItems/0/properties/unique-id/const');
    });

    it('should return messages for duplicate interface IDs on anyOf alternatives', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                { 'anyOf': [
                                    { 'properties': {
                                        'unique-id': { 'const': 'node1' },
                                        'interfaces': { prefixItems: [{ 'properties': { 'unique-id': { 'const': 'intf1' } } }] } }
                                    },
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
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: intf1, path: /properties/nodes/prefixItems/0/anyOf/1/properties/interfaces/prefixItems/0/properties/unique-id/const');
    });







});