import { describe, it, expect } from 'vitest';
import { logLine } from './log';

describe('logLine', () => {
    it('pads like the CLI winston format', () => {
        expect(logLine('info', 'calm-diff', 'Comparing a.json -> b.json')).toBe('info [calm-diff]:     Comparing a.json -> b.json');
        expect(logLine('error', 'calm-validate', 'x')).toBe('error [calm-validate]:    x');
    });
});
