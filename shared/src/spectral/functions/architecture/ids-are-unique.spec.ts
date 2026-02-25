import { idsAreUnique } from './ids-are-unique';

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
                    nodes: [
                        {
                            'unique-id': 'node1',
                            'interfaces': [{'unique-id': 'intf1'}]
                        },
                        {
                            'unique-id': 'node2'
                        }
                    ],
                    relationships: [
                        {'unique-id': 'rel1'},
                        {'unique-id': 'rel2'}
                    ]
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
                    nodes: [
                        {'unique-id': 'node1'},
                        {'unique-id': 'node1'}
                    ]
                }
            }
        };

        const result = idsAreUnique(input, null, context);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: node1, path: /nodes/1/unique-id');
    });

    it('should return messages for duplicate IDs within relationships', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    relationships: [
                        {'unique-id': 'rel1'},
                        {'unique-id': 'rel1'}
                    ]
                }
            }
        };

        const result = idsAreUnique(input, null, context);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: rel1, path: /relationships/1/unique-id');
    });


    it('should return messages for duplicate IDs within interfaces', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    nodes: [
                        {
                            'unique-id': 'node1',
                            'interfaces': [{'unique-id': 'intf1'}]
                        },
                        {
                            'unique-id': 'node2',
                            'interfaces': [{'unique-id': 'intf1'}]
                        }
                    ]
                }
            }
        };

        const result = idsAreUnique(input, null, context);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: intf1, path: /nodes/1/interfaces/0/unique-id');
    });



    it('should return messages for duplicate IDs across unique-ids', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    nodes: [
                        {'unique-id': 'node1'},
                        {'unique-id': 'node2'}
                    ],
                    relationships: [
                        {'unique-id': 'node1'},
                        {'unique-id': 'rel2'}
                    ]
                }
            }
        };

        const result = idsAreUnique(input, null, context);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: node1, path: /relationships/0/unique-id');
    });
});