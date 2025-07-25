import { describe, expect, it } from 'vitest';
import { DisplayAdrStatus } from './adr-helper-function.js';
import { CalmAdrStatus } from '@finos/calm-shared/src/types/adr-types.js';
describe('ADR Status', () => {
    it('should return Draft with orange styling if ADR status is draft', () => {
        const status: CalmAdrStatus = 'draft';
        expect(status.toString() === 'Draft');
        expect(DisplayAdrStatus({ adrStatus: status }).props.className).toContain('orange-500');
    });

    it('should return Proposed with teal styling if ADR status is proposed', () => {
        const status: CalmAdrStatus = 'proposed';
        expect(status.toString() === 'Proposed');
        expect(DisplayAdrStatus({ adrStatus: status }).props.className).toContain('teal-500');
    });

    it('should return Accepted with lime styling if ADR status is accepted', () => {
        const status: CalmAdrStatus = 'accepted';
        expect(status.toString() === 'Accepted');
        expect(DisplayAdrStatus({ adrStatus: status }).props.className).toContain('lime-500');
    });

    it('should return Superseded with violet styling if ADR status is superseded', () => {
        const status: CalmAdrStatus = 'superseded';
        expect(status.toString() === 'Superseded');
        expect(DisplayAdrStatus({ adrStatus: status }).props.className).toContain('violet-500');
    });

    it('should return Rejected with red styling if ADR status is rejected', () => {
        const status: CalmAdrStatus = 'rejected';
        expect(status.toString() === 'Rejected');
        expect(DisplayAdrStatus({ adrStatus: status }).props.className).toContain('red-500');
    });

    it('should return Deprecated with slate styling if ADR status is deprecated', () => {
        const status: CalmAdrStatus = 'deprecated';
        expect(status.toString() === 'Deprecated');
        expect(DisplayAdrStatus({ adrStatus: status }).props.className).toContain('slate-500');
    });
});
