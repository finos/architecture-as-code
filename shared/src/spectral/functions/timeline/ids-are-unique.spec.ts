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
                    moments: [
                        {'unique-id': 'node1'},
                        {'unique-id': 'node2'},
                    ]
                }
            }
        };

        const result = idsAreUnique(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return messages for duplicate IDs', () => {
        const input = {};
        const context = {
            document: {
                data: {
                    moments: [
                        {'unique-id': 'node1'},
                        {'unique-id': 'node2'},
                        {'unique-id': 'node1'}, // duplicate
                    ]
                }
            }
        };

        const result = idsAreUnique(input, null, context);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate unique-id detected. ID: node1, path: /moments/2/unique-id');
    });
});