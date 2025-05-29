import { describe, expect, it } from 'vitest';
import { adrStatus, displayAdrStatus } from './adrStatus.js';

describe('ADR Status', () => {
    it('should return Draft with orange styling if ADR status is draft', () => {
        let status = adrStatus.draft;
        expect(status.toString() === 'Draft');
        expect(displayAdrStatus(status).props.className).toContain('orange-500');
    });

    it('should return Proposed with teal styling if ADR status is proposed', () => {
        let status = adrStatus.proposed;
        expect(status.toString() === 'Proposed');
        expect(displayAdrStatus(status).props.className).toContain('teal-500');
    });

    it('should return Accepted with lime styling if ADR status is accepted', () => {
        let status = adrStatus.accepted;
        expect(status.toString() === 'Accepted');
        expect(displayAdrStatus(status).props.className).toContain('lime-500');
    });

    it('should return Superseded with violet styling if ADR status is superseded', () => {
        let status = adrStatus.superseded;
        expect(status.toString() === 'Superseded');
        expect(displayAdrStatus(status).props.className).toContain('violet-500');
    });

    it('should return Rejected with red styling if ADR status is rejected', () => {
        let status = adrStatus.rejected;
        expect(status.toString() === 'Rejected');
        expect(displayAdrStatus(status).props.className).toContain('red-500');
    });

    it('should return Deprecated with slate styling if ADR status is deprecated', () => {
        let status = adrStatus.deprecated;
        expect(status.toString() === 'Deprecated');
        expect(displayAdrStatus(status).props.className).toContain('slate-500');
    });
});
