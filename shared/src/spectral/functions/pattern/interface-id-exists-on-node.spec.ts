import { asContext } from '../spectral-test-helpers';
import { interfaceIdExistsOnNode } from './interface-id-exists-on-node';

describe('interfaceIdExistsOnNode', () => {
    it('should return an empty array when there is no input', () => {
        const input = null;
        const context = {
            document: {
                data: {}
            }
        };

        const result = interfaceIdExistsOnNode(input, null, asContext(context));
        expect(result).toEqual([]);
    });

    it('should return an empty array when input has no interfaces', () => {
        const input = {};
        const context = {
            document: {
                data: {}
            }
        };

        const result = interfaceIdExistsOnNode(input, null, asContext(context));
        expect(result).toEqual([]);
    });

    it('should return a message when input is a connect relationship missing a node', () => {
        const input = { interfaces: ['intf1'] };
        const context = {
            document: {
                data: {}
            },
            path: ['/relationships/0/connects/destination']
        };

        const result = interfaceIdExistsOnNode(input, null, asContext(context));
        expect(result.length).toBe(1);
        expect(result[0].message).toBe('Invalid connects relationship - no node defined.');
        expect(result[0].path).toEqual(['/relationships/0/connects/destination']);
    });

    it('should return an empty array when the node and interface exists', () => {
        const input = { node: 'node1', interfaces: ['intf1'] };
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                {
                                    properties: {
                                        'unique-id': { const: 'node1' },
                                        'interfaces': {
                                            prefixItems: [
                                                { properties: { 'unique-id': { const: 'intf1' } } } // will match this interface
                                            ]
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        };

        const result = interfaceIdExistsOnNode(input, null, asContext(context));
        expect(result).toEqual([]);
    });

    it('should return a message when the target node has no interfaces', () => {
        const input = { node: 'node1', interfaces: ['intf2'] };
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                {
                                    properties: {
                                        'unique-id': { const: 'node1' }
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            path: ['/relationships/0/connects/destination']
        };

        const result = interfaceIdExistsOnNode(input, null, asContext(context));
        expect(result.length).toBe(1);
        expect(result[0].message).toBe(`Node with unique-id ${input.node} has no interfaces defined, expected interfaces [${input.interfaces}]`);
    });

    it('should return a message when the interface does not exist', () => {
        const input = { node: 'node1', interfaces: ['intf2'] };
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                {
                                    properties: {
                                        'unique-id': { const: 'node1' },
                                        'interfaces': {
                                            prefixItems: [
                                                { properties: { 'unique-id': { const: 'intf1' } } } // will match this interface
                                            ]
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            path: ['/relationships/0/connects/destination']
        };

        const result = interfaceIdExistsOnNode(input, null, asContext(context));
        expect(result.length).toBe(1);
        expect(result[0].message).toBe(`Referenced interface with ID '${input.interfaces[0]}' was not defined on the node with ID '${input.node}'.`);
        expect(result[0].path).toEqual(['/relationships/0/connects/destination']);
    });

    it('should find a node declared in an items.oneOf catalog and validate its interfaces', () => {
        const input = { node: 'cache', interfaces: ['cache-intf'] };
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            items: {
                                oneOf: [
                                    {
                                        properties: {
                                            'unique-id': { const: 'cache' },
                                            'interfaces': {
                                                prefixItems: [
                                                    { properties: { 'unique-id': { const: 'cache-intf' } } }
                                                ]
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        };

        const result = interfaceIdExistsOnNode(input, null, asContext(context));
        expect(result).toEqual([]);
    });

    it('should report a missing interface on an items-catalog node instead of silently skipping it', () => {
        const input = { node: 'cache', interfaces: ['does-not-exist'] };
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            items: {
                                oneOf: [
                                    {
                                        properties: {
                                            'unique-id': { const: 'cache' },
                                            'interfaces': {
                                                prefixItems: [
                                                    { properties: { 'unique-id': { const: 'cache-intf' } } }
                                                ]
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            path: ['/relationships/0/connects/destination']
        };

        const result = interfaceIdExistsOnNode(input, null, asContext(context));
        expect(result.length).toBe(1);
        expect(result[0].message).toBe(`Referenced interface with ID '${input.interfaces[0]}' was not defined on the node with ID '${input.node}'.`);
    });

    it('should return a message when one interface does not exist', () => {
        const input = { node: 'node1', interfaces: ['intf1', 'intf2'] };
        const context = {
            document: {
                data: {
                    properties: {
                        nodes: {
                            prefixItems: [
                                {
                                    properties: {
                                        'unique-id': { const: 'node1' },
                                        'interfaces': {
                                            prefixItems: [
                                                { properties: { 'unique-id': { const: 'intf1' } } }
                                            ]
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            path: ['/relationships/0/connects/destination']
        };

        const result = interfaceIdExistsOnNode(input, null, asContext(context));
        expect(result.length).toBe(1);
        expect(result[0].message).toBe(`Referenced interface with ID '${input.interfaces[1]}' was not defined on the node with ID '${input.node}'.`);
        expect(result[0].path).toEqual(['/relationships/0/connects/destination']);
    });

    describe('a prefixItems oneOf slot with two node alternatives', () => {
        // { oneOf: [A(interfaces:[iA]), B(interfaces:[iB])] }. Before the migration to
        // listDeclaredCandidates, the inner unwrapping always resolved to alternative 0 and unioned
        // interfaces across every alternative in the slot - so only the first two rows here
        // passed; B was never findable, and interfaces borrowed across alternatives passed
        // silently. All four rows must now behave correctly.
        function contextWithTwoAlternatives() {
            return {
                document: {
                    data: {
                        properties: {
                            nodes: {
                                prefixItems: [
                                    {
                                        oneOf: [
                                            {
                                                properties: {
                                                    'unique-id': { const: 'A' },
                                                    interfaces: { prefixItems: [{ properties: { 'unique-id': { const: 'iA' } } }] }
                                                }
                                            },
                                            {
                                                properties: {
                                                    'unique-id': { const: 'B' },
                                                    interfaces: { prefixItems: [{ properties: { 'unique-id': { const: 'iB' } } }] }
                                                }
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                },
                path: ['/relationships/0/connects/destination']
            };
        }

        it('accepts A referencing its own interface iA', () => {
            const input = { node: 'A', interfaces: ['iA'] };
            expect(interfaceIdExistsOnNode(input, null, asContext(contextWithTwoAlternatives()))).toEqual([]);
        });

        it('rejects A referencing iB, which belongs to B (was a false negative)', () => {
            const input = { node: 'A', interfaces: ['iB'] };
            const result = interfaceIdExistsOnNode(input, null, asContext(contextWithTwoAlternatives()));
            expect(result.length).toBe(1);
            expect(result[0].message).toBe('Referenced interface with ID \'iB\' was not defined on the node with ID \'A\'.');
        });

        it('accepts B referencing its own interface iB (B was previously never findable)', () => {
            const input = { node: 'B', interfaces: ['iB'] };
            expect(interfaceIdExistsOnNode(input, null, asContext(contextWithTwoAlternatives()))).toEqual([]);
        });

        it('rejects B referencing a nonexistent interface (was silently unchecked)', () => {
            const input = { node: 'B', interfaces: ['nope'] };
            const result = interfaceIdExistsOnNode(input, null, asContext(contextWithTwoAlternatives()));
            expect(result.length).toBe(1);
            expect(result[0].message).toBe('Referenced interface with ID \'nope\' was not defined on the node with ID \'B\'.');
        });
    });
});