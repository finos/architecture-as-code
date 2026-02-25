import { interfaceIdExistsOnNode } from './interface-id-exists-on-node';

describe('interfaceIdExistsOnNode', () => {
    it('should return an empty array when there is no input', () => {
        const input = null;
        const context = {
            document: {
                data: {}
            }
        };

        const result = interfaceIdExistsOnNode(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return an empty array when input has no interfaces', () => {
        const input = {};
        const context = {
            document: {
                data: {}
            }
        };

        const result = interfaceIdExistsOnNode(input, null, context);
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

        const result = interfaceIdExistsOnNode(input, null, context);
        expect(result.length).toBe(1);
        expect(result[0].message).toBe('Invalid connects relationship - no node defined.');
        expect(result[0].path).toEqual(['/relationships/0/connects/destination']);
    });

    it('should return an empty array when the node and interface exists', () => {
        const input = { node: 'node1', interfaces: ['intf1'] };
        const context = {
            document: {
                data: {
                    nodes: [
                        {
                            'unique-id': 'node1',
                            'interfaces': [
                                {'unique-id': 'intf1'} // will match this interface
                            ]
                        }
                    ]
                }
            }
        };

        const result = interfaceIdExistsOnNode(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return a message when the target node has no interfaces', () => {
        const input = { node: 'node1', interfaces: ['intf2'] };
        const context = {
            document: {
                data: {
                    nodes: [{'unique-id': 'node1'}]
                }
            },
            path: ['/relationships/0/connects/destination']
        };

        const result = interfaceIdExistsOnNode(input, null, context);
        expect(result.length).toBe(1);
        expect(result[0].message).toBe(`Node with unique-id ${input.node} has no interfaces defined, expected interfaces [${input.interfaces}].`);
    });

    it('should return a message when the interface does not exist', () => {
        const input = { node: 'node1', interfaces: ['intf2'] };
        const context = {
            document: {
                data: {
                    nodes: [
                        {
                            'unique-id': 'node1',
                            'interfaces': [
                                {'unique-id': 'intf1'}
                            ]
                        }
                    ]
                }
            },
            path: ['/relationships/0/connects/destination']
        };

        const result = interfaceIdExistsOnNode(input, null, context);
        expect(result.length).toBe(1);
        expect(result[0].message).toBe(`Referenced interface with ID '${input.interfaces[0]}' was not defined on the node with ID '${input.node}'.`);
        expect(result[0].path).toEqual(['/relationships/0/connects/destination']);
    });

    it('should return a message when one interface does not exist', () => {
        const input = { node: 'node1', interfaces: ['intf1', 'intf2'] };
        const context = {
            document: {
                data: {
                    nodes: [
                        {
                            'unique-id': 'node1',
                            'interfaces': [
                                {'unique-id': 'intf1'}
                            ]
                        }
                    ]
                }
            },
            path: ['/relationships/0/connects/destination']
        };

        const result = interfaceIdExistsOnNode(input, null, context);
        expect(result.length).toBe(1);
        expect(result[0].message).toBe(`Referenced interface with ID '${input.interfaces[1]}' was not defined on the node with ID '${input.node}'.`);
        expect(result[0].path).toEqual(['/relationships/0/connects/destination']);
    });
});