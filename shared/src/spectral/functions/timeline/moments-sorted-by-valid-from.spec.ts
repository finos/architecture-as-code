import { momentsSortedByValidFrom } from './moments-sorted-by-valid-from';

describe('momentsSortedByValidFrom', () => {
    it('should return an empty array when there is no input', () => {
        const input = null;

        const result = momentsSortedByValidFrom(input);
        expect(result).toEqual([]);
    });

    it('should return an empty array when moments are missing', () => {
        const input = {};

        const result = momentsSortedByValidFrom(input);
        expect(result).toEqual([]);
    });

    it('should return an empty array when valid-froms are sorted', () => {
        const input = {
            moments: [
                { 'unique-id': 'moment1', 'valid-from': '2023-01-01' },
                { 'unique-id': 'moment2', 'valid-from': '2024-01-01' },
                { 'unique-id': 'moment3' }
            ]
        };

        const result = momentsSortedByValidFrom(input);
        expect(result).toEqual([]);
    });

    it('should return a message when valid-froms are out of order', () => {
        const input = {
            moments: [
                { 'unique-id': 'moment1', 'valid-from': '2024-01-01' },
                { 'unique-id': 'moment2', 'valid-from': '2023-01-01' }
            ]
        };

        const result = momentsSortedByValidFrom(input);
        expect(result.length).toBe(1);
        expect(result[0].message).toBe('Moment with unique-id "moment2" has valid-from "2023-01-01" which is before the previous valid-from "2024-01-01".');
    });
});
