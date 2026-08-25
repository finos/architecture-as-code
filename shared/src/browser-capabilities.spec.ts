import { describe, it, expect } from 'vitest';
import { BROWSER_COMMAND_SUPPORT, browserSupportFor } from './browser-capabilities';

describe('browser capability manifest', () => {
    it('marks the pure engine commands as supported', () => {
        for (const cmd of ['validate', 'generate', 'diff', 'timeline']) {
            expect(browserSupportFor(cmd)).toEqual({ command: cmd, status: 'supported' });
        }
    });

    it('gives a reason for every unsupported command', () => {
        const unsupported = BROWSER_COMMAND_SUPPORT.filter((e) => e.status === 'unsupported');
        expect(unsupported.length).toBeGreaterThan(0);
        for (const entry of unsupported) {
            expect(entry.reason.length).toBeGreaterThan(10);
        }
    });

    it('returns undefined for unknown commands', () => {
        expect(browserSupportFor('frobnicate')).toBeUndefined();
    });

    it('has no duplicate keys', () => {
        const keys = BROWSER_COMMAND_SUPPORT.map((e) => e.command);
        expect(new Set(keys).size).toBe(keys.length);
    });
});
