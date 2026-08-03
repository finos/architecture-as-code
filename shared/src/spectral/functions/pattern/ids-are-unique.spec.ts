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
                                {'properties': {
                                    'unique-id': {'const': 'node1'},
                                    'interfaces': {prefixItems: [{'properties': {'unique-id': {'const': 'intf1'}}}]}}
                                },
                                {'properties': {'unique-id': {'const': 'node2'}}}
                            ]
                        },
                        relationships: {
                            prefixItems: [
                                {'properties': {'unique-id': {'const': 'rel1'}}},
                                {'properties': {'unique-id': {'const': 'rel2'}}}
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
                                {'properties': {'unique-id': {'const': 'node1'}}},
                                {'properties': {'unique-id': {'const': 'node1'}}}
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
                                {'properties': {'unique-id': {'const': 'rel1'}}},
                                {'properties': {'unique-id': {'const': 'rel1'}}}
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
                                {'properties': {
                                    'unique-id': {'const': 'node1'},
                                    'interfaces': {prefixItems: [{'properties': {'unique-id': {'const': 'intf1'}}}]}}
                                },
                                {'properties': {
                                    'unique-id': {'const': 'node2'},
                                    'interfaces': {prefixItems: [{'properties': {'unique-id': {'const': 'intf1'}}}]}}
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



    it('should return messages for duplicate IDs within nodes.items.oneOf', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                {'properties': {'unique-id': {'const': 'webapp'}}}
                            ],
                            items: {
                                oneOf: [
                                    {'properties': {'unique-id': {'const': 'cache'}}},
                                    {'properties': {'unique-id': {'const': 'cache'}}}
                                ]
                            }
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: cache, path: /properties/nodes/items/oneOf/1/properties/unique-id/const');
    });

    it('should return messages for duplicate IDs within relationships.items.oneOf', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        relationships: {
                            items: {
                                oneOf: [
                                    {'properties': {'unique-id': {'const': 'edge'}}},
                                    {'properties': {'unique-id': {'const': 'edge'}}}
                                ]
                            }
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: edge, path: /properties/relationships/items/oneOf/1/properties/unique-id/const');
    });

    it('should return messages for duplicate IDs across a prefixItems node and an items.oneOf node', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                {'properties': {'unique-id': {'const': 'webapp'}}}
                            ],
                            items: {
                                oneOf: [
                                    {'properties': {'unique-id': {'const': 'webapp'}}}
                                ]
                            }
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: webapp, path: /properties/nodes/items/oneOf/0/properties/unique-id/const');
    });

    it('should return messages for duplicate interface IDs inside catalog nodes', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            items: {
                                anyOf: [
                                    {'properties': {
                                        'unique-id': {'const': 'cache'},
                                        'interfaces': {prefixItems: [{'properties': {'unique-id': {'const': 'intf1'}}}]}}
                                    },
                                    {'properties': {
                                        'unique-id': {'const': 'queue'},
                                        'interfaces': {prefixItems: [{'properties': {'unique-id': {'const': 'intf1'}}}]}}
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, asContext(context));
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: intf1, path: /properties/nodes/items/anyOf/1/properties/interfaces/prefixItems/0/properties/unique-id/const');
    });


    it('should return messages for duplicate IDs across unique-ids', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                {'properties': {'unique-id': {'const': 'node1'}}},
                                {'properties': {'unique-id': {'const': 'node2'}}}
                            ]
                        },
                        relationships: {
                            prefixItems: [
                                {'properties': {'unique-id': {'const': 'node1'}}},
                                {'properties': {'unique-id': {'const': 'rel2'}}}
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
});