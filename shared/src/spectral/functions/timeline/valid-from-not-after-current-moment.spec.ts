import { validFromNotAfterCurrentMoment } from './valid-from-not-after-current-moment';

describe('validFromNotAfterCurrentMoment', () => {
    it('should return an empty array when there is no input', () => {
        const input = null;
        const context = {
            document: {
                data: {}
            }
        };

        const result = validFromNotAfterCurrentMoment(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return an empty array when no moments', () => {
        const input = 'moment1';
        const context = {
            document: {
                data: {
                    moments: []
                }
            }
        };

        const result = validFromNotAfterCurrentMoment(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return an empty array when no valid-froms', () => {
        const input = 'moment1';
        const context = {
            document: {
                data: {
                    moments: [
                        {'unique-id': 'moment1'},
                        {'unique-id': 'moment2'}
                    ]
                }
            }
        };

        const result = validFromNotAfterCurrentMoment(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return an empty array when valid-froms before current moment', () => {
        const input = 'moment2';
        const context = {
            document: {
                data: {
                    moments: [
                        {'unique-id': 'moment1', 'valid-from': '2023-01-01'},
                        {'unique-id': 'moment2'},
                        {'unique-id': 'moment3'}
                    ]
                }
            }
        };

        const result = validFromNotAfterCurrentMoment(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return an empty array when valid-froms at current moment', () => {
        const input = 'moment2';
        const context = {
            document: {
                data: {
                    moments: [
                        {'unique-id': 'moment1', 'valid-from': '2023-01-01'},
                        {'unique-id': 'moment2', 'valid-from': '2024-01-01'},
                        {'unique-id': 'moment3'}
                    ]
                }
            }
        };

        const result = validFromNotAfterCurrentMoment(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return an empty array when valid-froms at current moment, which is the last moment', () => {
        const input = 'moment3';
        const context = {
            document: {
                data: {
                    moments: [
                        {'unique-id': 'moment1', 'valid-from': '2023-01-01'},
                        {'unique-id': 'moment2', 'valid-from': '2024-01-01'},
                        {'unique-id': 'moment3', 'valid-from': '2025-01-01'}
                    ]
                }
            }
        };

        const result = validFromNotAfterCurrentMoment(input, null, context);
        expect(result).toEqual([]);
    });

    it('should return a message when a valid-from exists on a moment after the current', () => {
        const input = 'moment2';
        const context = {
            document: {
                data: {
                    moments: [
                        {'unique-id': 'moment1', 'valid-from': '2023-01-01'},
                        {'unique-id': 'moment2', 'valid-from': '2024-01-01'},
                        {'unique-id': 'moment3', 'valid-from': '2025-01-01'}
                    ]
                }
            }
        };

        const result = validFromNotAfterCurrentMoment(input, null, context);
        expect(result.length).toBe(1);
        expect(result[0].message).toBe('Moment with unique-id "moment3" is after current-moment "moment2" but has a valid-from.');
    });
});