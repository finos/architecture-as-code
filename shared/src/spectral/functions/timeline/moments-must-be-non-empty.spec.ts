import { momentsMustBeNonEmpty } from './moments-must-be-non-empty';

describe('momentsMustBeNonEmpty', () => {
    it('should return an empty array when there is no input', () => {
        const input = null;

        const result = momentsMustBeNonEmpty(input);
        expect(result).toEqual([]);
    });

    it('should return a message when moments is missing', () => {
        const input = {};

        const result = momentsMustBeNonEmpty(input);
        expect(result.length).toBe(1);
        expect(result[0].message).toBe('Timeline must define at least one moment.');
    });

    it('should return a message when moments is empty', () => {
        const input = { moments: [] };

        const result = momentsMustBeNonEmpty(input);
        expect(result.length).toBe(1);
        expect(result[0].message).toBe('Timeline must define at least one moment.');
    });

    it('should return an empty array when moments is non-empty', () => {
        const input = { moments: [{ 'unique-id': 'moment1' }] };

        const result = momentsMustBeNonEmpty(input);
        expect(result).toEqual([]);
    });
});
