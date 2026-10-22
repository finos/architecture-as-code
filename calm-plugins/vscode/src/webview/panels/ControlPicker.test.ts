import { describe, it, expect } from 'vitest';
import { makeControlMapKey } from '../../extension/services/control-curie';

describe('ControlPicker helpers', () => {
    describe('buildRef', () => {
        function buildRef(entry: { source: string; domain: string; controlName: string; requirementRef?: string }): string {
            if (entry.source === 'local') return entry.requirementRef ?? '';
            return `${entry.domain}:controls:${entry.controlName}`;
        }

        it('returns local requirementRef for local controls', () => {
            expect(buildRef({ source: 'local', domain: 'Local', controlName: 'tier', requirementRef: './controls/tier.json' }))
                .toBe('./controls/tier.json');
        });

        it('returns empty string when local control has no requirementRef', () => {
            expect(buildRef({ source: 'local', domain: 'Local', controlName: 'tier' })).toBe('');
        });

        it('builds a CURIE for Hub controls', () => {
            expect(buildRef({ source: 'hub', domain: 'platform', controlName: 'resiliency' }))
                .toBe('platform:controls:resiliency');
        });
    });

    describe('duplicate detection', () => {
        it('detects duplicate by makeControlMapKey', () => {
            const ref = 'platform:controls:resiliency';
            const mapKey = makeControlMapKey(ref);
            const existing = new Set([mapKey]);
            expect(existing.has(mapKey)).toBe(true);
        });

        it('detects duplicate by controlName fallback', () => {
            const existing = new Set(['resiliency']);
            const entry = { controlName: 'resiliency', title: 'Resiliency Tier' };
            expect(existing.has(entry.controlName)).toBe(true);
        });

        it('detects duplicate by title fallback', () => {
            const existing = new Set(['Resiliency Tier']);
            const entry = { controlName: 'resiliency', title: 'Resiliency Tier' };
            expect(existing.has(entry.title)).toBe(true);
        });

        it('allows attach when not a duplicate', () => {
            const existing = new Set(['other-control']);
            const ref = 'platform:controls:resiliency';
            const mapKey = makeControlMapKey(ref);
            const entry = { controlName: 'resiliency', title: 'Resiliency Tier' };
            const duplicate = existing.has(mapKey) || existing.has(entry.controlName) || existing.has(entry.title);
            expect(duplicate).toBe(false);
        });
    });

    describe('filterEntry', () => {
        const entry = { title: 'Resiliency Tier', controlName: 'resiliency', description: 'Ensures high availability' };

        function filterEntry(e: typeof entry, search: string): boolean {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return e.title.toLowerCase().includes(q) || e.controlName.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
        }

        it('returns true when search is empty', () => {
            expect(filterEntry(entry, '')).toBe(true);
            expect(filterEntry(entry, '   ')).toBe(true);
        });

        it('matches by title', () => {
            expect(filterEntry(entry, 'resiliency')).toBe(true);
        });

        it('matches by controlName', () => {
            expect(filterEntry(entry, 'resiliency')).toBe(true);
        });

        it('matches by description', () => {
            expect(filterEntry(entry, 'availability')).toBe(true);
        });

        it('is case insensitive', () => {
            expect(filterEntry(entry, 'TIER')).toBe(true);
        });

        it('returns false when nothing matches', () => {
            expect(filterEntry(entry, 'encryption')).toBe(false);
        });
    });
});
