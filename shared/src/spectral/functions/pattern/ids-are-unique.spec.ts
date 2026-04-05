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

        const result = idsAreUnique(input, null, context);
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

        const result = idsAreUnique(input, null, context);
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

        const result = idsAreUnique(input, null, context);
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

        const result = idsAreUnique(input, null, context);
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

        const result = idsAreUnique(input, null, context);
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

        const result = idsAreUnique(input, null, context);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: node1, path: /properties/relationships/prefixItems/0/properties/unique-id/const');
    });

    it('should return messages for duplicate IDs when a node inside anyOf duplicates a regular node', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                {'properties': {'unique-id': {'const': 'node1'}}},
                                {
                                    'anyOf': [
                                        {'properties': {'unique-id': {'const': 'node1'}}},
                                        {'properties': {'unique-id': {'const': 'node2'}}}
                                    ]
                                }
                            ]
                        },
                        relationships: {
                            prefixItems: [
                                {'properties': {'unique-id': {'const': 'rel1'}}}
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, context);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: node1, path: /properties/nodes/prefixItems/1/anyOf/0/properties/unique-id/const');
    });

    it('should return messages for duplicate IDs when a relationship inside oneOf duplicates a regular relationship', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                {'properties': {'unique-id': {'const': 'node1'}}}
                            ]
                        },
                        relationships: {
                            prefixItems: [
                                {'properties': {'unique-id': {'const': 'rel1'}}},
                                {
                                    'oneOf': [
                                        {'properties': {'unique-id': {'const': 'rel1'}}},
                                        {'properties': {'unique-id': {'const': 'rel2'}}}
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, context);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: rel1, path: /properties/relationships/prefixItems/1/oneOf/0/properties/unique-id/const');
    });

    it('should not return messages when anyOf node IDs are all unique', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                {'properties': {'unique-id': {'const': 'node1'}}},
                                {
                                    'anyOf': [
                                        {'properties': {'unique-id': {'const': 'node2'}}},
                                        {'properties': {'unique-id': {'const': 'node3'}}}
                                    ]
                                }
                            ]
                        },
                        relationships: {
                            prefixItems: [
                                {'properties': {'unique-id': {'const': 'rel1'}}}
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, context);
        expect(result).toEqual([]);
    });

    it('should not return messages for duplicate IDs that are siblings within the same oneOf block', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                {'properties': {'unique-id': {'const': 'node1'}}}
                            ]
                        },
                        relationships: {
                            prefixItems: [
                                {
                                    'oneOf': [
                                        {'properties': {'unique-id': {'const': 'rel1'}}},
                                        {'properties': {'unique-id': {'const': 'rel1'}}}
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return messages for duplicate IDs across different oneOf blocks', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                {'properties': {'unique-id': {'const': 'node1'}}}
                            ]
                        },
                        relationships: {
                            prefixItems: [
                                {
                                    'oneOf': [
                                        {'properties': {'unique-id': {'const': 'rel1'}}},
                                        {'properties': {'unique-id': {'const': 'rel2'}}}
                                    ]
                                },
                                {
                                    'oneOf': [
                                        {'properties': {'unique-id': {'const': 'rel1'}}},
                                        {'properties': {'unique-id': {'const': 'rel3'}}}
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        };

        const result = idsAreUnique(input, null, context);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: rel1, path: /properties/relationships/prefixItems/1/oneOf/0/properties/unique-id/const');
    });
});