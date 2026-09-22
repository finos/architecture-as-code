import { describe, it, expect } from 'vitest';
import { mergeControls } from './merge-controls.js';

describe('mergeControls', () => {
    it('preserves existing key (not overwritten by incoming)', () => {
        const existing = { security: { level: 'high' } };
        const incoming = { security: { level: 'low' } };
        const result = mergeControls(existing, incoming);
        expect(result.security).toEqual({ level: 'high' });
    });

    it('fills missing key from incoming (deep-copied)', () => {
        const existing = { security: { level: 'high' } };
        const incoming = { compliance: { standard: 'PCI-DSS' } };
        const result = mergeControls(existing, incoming);
        expect(result.security).toEqual({ level: 'high' });
        expect(result.compliance).toEqual({ standard: 'PCI-DSS' });
    });

    it('returns all incoming keys when existing is empty', () => {
        const existing = {};
        const incoming = { security: { level: 'high' }, compliance: { standard: 'SOC2' } };
        const result = mergeControls(existing, incoming);
        expect(result).toEqual({ security: { level: 'high' }, compliance: { standard: 'SOC2' } });
    });

    it('returns existing unchanged when incoming is empty', () => {
        const existing = { security: { level: 'high' } };
        const incoming = {};
        const result = mergeControls(existing, incoming);
        expect(result).toEqual({ security: { level: 'high' } });
    });

    it('deep copies incoming values (modifying source does not affect merged result)', () => {
        const existing = {};
        const incomingValue = { nested: { deep: 'original' } };
        const incoming = { control: incomingValue };
        const result = mergeControls(existing, incoming);

        // Mutate the source
        incomingValue.nested.deep = 'mutated';

        // Merged result should not be affected
        expect((result.control as { nested: { deep: string } }).nested.deep).toBe('original');
    });
});
