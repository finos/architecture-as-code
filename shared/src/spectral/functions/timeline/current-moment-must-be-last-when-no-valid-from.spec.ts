import { currentMomentMustBeLastWhenNoValidFrom } from './current-moment-must-be-last-when-no-valid-from';

describe('currentMomentMustBeLastWhenNoValidFrom', () => {
    it('should return an empty array when there is no input', () => {
        const input = null;

        const result = currentMomentMustBeLastWhenNoValidFrom(input);
        expect(result).toEqual([]);
    });

    it('should return an empty array when there are no moments', () => {
        const input = { moments: [] };

        const result = currentMomentMustBeLastWhenNoValidFrom(input);
        expect(result).toEqual([]);
    });

    it('should return an empty array when any valid-from exists', () => {
        const input = {
            'current-moment': 'moment1',
            moments: [
                { 'unique-id': 'moment1', 'valid-from': '2023-01-01' },
                { 'unique-id': 'moment2' }
            ]
        };

        const result = currentMomentMustBeLastWhenNoValidFrom(input);
        expect(result).toEqual([]);
    });

    it('should return an empty array when current-moment is the last moment', () => {
        const input = {
            'current-moment': 'moment2',
            moments: [
                { 'unique-id': 'moment1' },
                { 'unique-id': 'moment2' }
            ]
        };

        const result = currentMomentMustBeLastWhenNoValidFrom(input);
        expect(result).toEqual([]);
    });

    it('should return a message when current-moment is not the last moment', () => {
        const input = {
            'current-moment': 'moment1',
            moments: [
                { 'unique-id': 'moment1' },
                { 'unique-id': 'moment2' }
            ]
        };

        const result = currentMomentMustBeLastWhenNoValidFrom(input);
        expect(result.length).toBe(1);
        expect(result[0].message).toBe('Current-moment "moment1" should be the last moment when no valid-from values are defined.');
    });
});
