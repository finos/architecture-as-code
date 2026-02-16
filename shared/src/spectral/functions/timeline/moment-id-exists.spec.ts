import { momentIdExists } from './moment-id-exists';

describe('momentIdExists', () => {
    it('should return an empty array when there is no input', () => {
        const input = null;
        const context = {
            document: {
                data: {}
            }
        };

        const result = momentIdExists(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return an empty array when the ID exists', () => {
        const input = 'moment1';
        const context = {
            document: {
                data: {
                    moments: [
                        {'unique-id': 'moment1'}, // will match this moment
                        {'unique-id': 'moment2'}
                    ]
                }
            }
        };

        const result = momentIdExists(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return a message when the ID does not exist', () => {
        const input = 'moment3';
        const context = {
            document: {
                data: {
                    moments: [
                        {'unique-id': 'moment1'},
                        {'unique-id': 'moment2'}
                    ]
                }
            },
            path: ['/current-moment']
        };

        const result = momentIdExists(input, null, context);
        expect(result.length).toBe(1);
        expect(result[0].message).toBe(`'${input}' does not refer to the unique-id of an existing moment.`);
        expect(result[0].path).toEqual(['/current-moment']);
    });
});