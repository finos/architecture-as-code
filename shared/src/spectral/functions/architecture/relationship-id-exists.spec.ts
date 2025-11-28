import { relationshipIdExists } from './relationship-id-exists';

describe('relationshipIdExists', () => {
    it('should return an empty array when there is no input', () => {
        const input = null;
        const context = {
            document: {
                data: {}
            }
        };

        const result = relationshipIdExists(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return an empty array when the ID exists', () => {
        const input = 'relationship1';
        const context = {
            document: {
                data: {
                    relationships: [
                        {'unique-id': 'relationship1'}
                    ]
                }
            }
        };

        const result = relationshipIdExists(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return a message when the ID does not exist', () => {
        const input = 'relationship2';
        const context = {
            document: {
                data: {
                    relationships: [
                        {'unique-id': 'relationship1'}
                    ]
                }
            },
            path: ['/relationships/0']
        };

        const result = relationshipIdExists(input, null, context);
        expect(result.length).toBe(1);
        expect(result[0].message).toBe(`'${input}' does not refer to the unique-id of an existing relationship.`);
        expect(result[0].path).toEqual(['/relationships/0']);
    });
});