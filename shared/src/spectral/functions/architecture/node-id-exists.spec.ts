import { nodeIdExists } from './node-id-exists';

describe('nodeIdExists', () => {
    it('should return an empty array when there is no input', () => {
        const input = null;
        const context = {
            document: {
                data: {}
            }
        };

        const result = nodeIdExists(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return an empty array when the ID exists', () => {
        const input = 'node1';
        const context = {
            document: {
                data: {
                    nodes: [
                        {'unique-id': 'node1'}
                    ]
                }
            }
        };

        const result = nodeIdExists(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return a message when the ID does not exist', () => {
        const input = 'node2';
        const context = {
            document: {
                data: {
                    nodes: [
                        {'unique-id': 'node1'}
                    ]
                }
            },
            path: ['/relationships/0/connects/destination']
        };

        const result = nodeIdExists(input, null, context);
        expect(result.length).toBe(1);
        expect(result[0].message).toBe(`'${input}' does not refer to the unique-id of an existing node.`);
        expect(result[0].path).toEqual(['/relationships/0/connects/destination']);
    });
});