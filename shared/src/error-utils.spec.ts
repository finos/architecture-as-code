import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './error-utils';

describe('getErrorMessage', () => {
    it('returns the message of an Error instance', () => {
        expect(getErrorMessage(new Error('boom'))).toBe('boom');
    });

    it('returns the message of an Error subclass', () => {
        class CustomError extends Error {}
        expect(getErrorMessage(new CustomError('custom failure'))).toBe('custom failure');
    });

    it('coerces a non-Error string throw to a string', () => {
        expect(getErrorMessage('just a string')).toBe('just a string');
    });

    it('coerces a non-Error object throw to a string', () => {
        expect(getErrorMessage({ code: 42 })).toBe('[object Object]');
    });

    it('coerces null and undefined throws to a string', () => {
        expect(getErrorMessage(null)).toBe('null');
        expect(getErrorMessage(undefined)).toBe('undefined');
    });
});
