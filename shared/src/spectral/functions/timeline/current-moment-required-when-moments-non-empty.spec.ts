import { currentMomentRequiredWhenMomentsNonEmpty } from './current-moment-required-when-moments-non-empty';

describe('currentMomentRequiredWhenMomentsNonEmpty', () => {
    it('should return an empty array when there is no input', () => {
        const input = null;

        const result = currentMomentRequiredWhenMomentsNonEmpty(input);
        expect(result).toEqual([]);
    });

    it('should return an empty array when moments is empty', () => {
        const input = { moments: [] };

        const result = currentMomentRequiredWhenMomentsNonEmpty(input);
        expect(result).toEqual([]);
    });

    it('should return an empty array when current-moment is provided', () => {
        const input = {
            'current-moment': 'moment2',
            moments: [
                { 'unique-id': 'moment1' },
                { 'unique-id': 'moment2' }
            ]
        };

        const result = currentMomentRequiredWhenMomentsNonEmpty(input);
        expect(result).toEqual([]);
    });

    it('should return a message when moments exist but current-moment is missing', () => {
        const input = {
            moments: [
                { 'unique-id': 'moment1' }
            ]
        };

        const result = currentMomentRequiredWhenMomentsNonEmpty(input);
        expect(result.length).toBe(1);
        expect(result[0].message).toBe('Timeline has moments but no current-moment is set.');
    });
});
