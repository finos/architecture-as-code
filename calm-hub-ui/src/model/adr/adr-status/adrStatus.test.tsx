import { describe, expect, it } from 'vitest';
import { AdrStatus, DisplayAdrStatus } from './adrStatus.js';

describe('ADR Status', () => {
    it('should return Draft with orange styling if ADR status is draft', () => {
        const status: AdrStatus = 'draft';
        expect(status.toString() === 'Draft');
        expect(DisplayAdrStatus({ adrStatus: status }).props.className).toContain('orange-500');
    });

    it('should return Proposed with teal styling if ADR status is proposed', () => {
        const status: AdrStatus = 'proposed';
        expect(status.toString() === 'Proposed');
        expect(DisplayAdrStatus({ adrStatus: status }).props.className).toContain('teal-500');
    });

    it('should return Accepted with lime styling if ADR status is accepted', () => {
        const status: AdrStatus = 'accepted';
        expect(status.toString() === 'Accepted');
        expect(DisplayAdrStatus({ adrStatus: status }).props.className).toContain('lime-500');
    });

    it('should return Superseded with violet styling if ADR status is superseded', () => {
        const status: AdrStatus = 'superseded';
        expect(status.toString() === 'Superseded');
        expect(DisplayAdrStatus({ adrStatus: status }).props.className).toContain('violet-500');
    });

    it('should return Rejected with red styling if ADR status is rejected', () => {
        const status: AdrStatus = 'rejected';
        expect(status.toString() === 'Rejected');
        expect(DisplayAdrStatus({ adrStatus: status }).props.className).toContain('red-500');
    });

    it('should return Deprecated with slate styling if ADR status is deprecated', () => {
        const status: AdrStatus = 'deprecated';
        expect(status.toString() === 'Deprecated');
        expect(DisplayAdrStatus({ adrStatus: status }).props.className).toContain('slate-500');
    });
});
