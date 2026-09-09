import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationOutcome } from './validation.output';

describe('formatOutput registry', () => {
    beforeEach(() => vi.resetModules());

    const outcome = new ValidationOutcome([], [], false, false);

    it('formats json and pretty without any registration', async () => {
        const { formatOutput } = await import('./format-output');
        expect(JSON.parse(formatOutput(outcome, 'json'))).toMatchObject({ hasErrors: false });
        expect(formatOutput(outcome, 'pretty')).toContain('No issues found');
    });

    it('throws a clear error for an unregistered format', async () => {
        const { formatOutput } = await import('./format-output');
        expect(() => formatOutput(outcome, 'junit')).toThrow(/junit.*not available/i);
    });

    it('uses a registered formatter', async () => {
        const { formatOutput, registerOutputFormatter } = await import('./format-output');
        registerOutputFormatter('junit', () => '<xml/>');
        expect(formatOutput(outcome, 'junit')).toBe('<xml/>');
    });

    it('the root barrel registers junit', async () => {
        const { getFormattedOutput } = await import('../../index');
        expect(getFormattedOutput(outcome, 'junit')).toContain('<testsuite');
    });
});
