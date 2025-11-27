import { sequenceNumbersAreUnique } from './sequence-numbers-are-unique';

describe('sequenceNumbersAreUnique', () => {
    it('should return an empty array when there is no input', () => {
        const input = null;
        const context = {
            document: {
                data: {},
            },
            path: ['flows', 0, 'transitions']
        };

        const result = sequenceNumbersAreUnique(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return an empty array when there are no duplicate numbers', () => {
        const input = [
            { 'sequence-number': 1 },
            { 'sequence-number': 2 }
        ];
        const context = {
            document: {
                data: {},
            },
            path: ['flows', 0, 'transitions']
        };

        const result = sequenceNumbersAreUnique(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return messages for duplicate numbers within transitions', () => {
        const input = [
            { 'sequence-number': 1 },
            { 'sequence-number': 1 }
        ];
        const context = {
            document: {
                data: {},
            },
            path: ['flows', 0, 'transitions']
        };

        const result = sequenceNumbersAreUnique(input, null, context);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].message).toContain('Duplicate sequence-number 1 detected. path: /1/sequence-number');
    });
});