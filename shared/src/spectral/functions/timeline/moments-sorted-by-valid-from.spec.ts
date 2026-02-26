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

    it('should ignore invalid valid-from values when checking order', () => {
        const input = {
            moments: [
                { 'unique-id': 'moment1', 'valid-from': '2023-01-01' },
                { 'unique-id': 'moment2', 'valid-from': 'not-a-date' },
                { 'unique-id': 'moment3', 'valid-from': '2024-01-01' }
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

    it('should allow moments with the same valid-from timestamp', () => {
        const input = {
            moments: [
                { 'unique-id': 'moment1', 'valid-from': '2024-01-01' },
                { 'unique-id': 'moment2', 'valid-from': '2024-01-01' }
            ]
        };

        const result = momentsSortedByValidFrom(input);
        expect(result).toEqual([]);
    });

    it('should use index as fallback when unique-id is missing for out-of-order moments', () => {
        const input = {
            moments: [
                { 'unique-id': 'moment1', 'valid-from': '2024-01-01' },
                { 'valid-from': '2023-01-01' }
            ]
        };

        const result = momentsSortedByValidFrom(input);
        expect(result.length).toBe(1);
        expect(result[0].message).toBe('Moment with index 1 has valid-from "2023-01-01" which is before the previous valid-from "2024-01-01".');
    });
});
