import { describe, it, expect } from 'vitest';
import { makeControlMapKey } from '../../extension/services/control-curie';
import { buildControlIdentity, entryKey, groupByPath } from './ControlPicker';
import type { ControlBrowseEntry } from '../../extension/services/control-asset-service';

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

    describe('control identity', () => {
        const hubEntry: ControlBrowseEntry = {
            source: 'hub', domain: 'security', controlName: 'seg',
            hubId: 'aws/prod/seg', tags: { path: 'aws/prod', variant: 'markdown' },
            title: 'Seg', description: '',
        };

        it('derives the full identity from a Hub entry', () => {
            expect(buildControlIdentity(hubEntry)).toEqual({
                domain: 'security', controlName: 'seg',
                hubId: 'aws/prod/seg', path: 'aws/prod', variant: 'markdown',
            });
        });

        it('has no identity for local controls', () => {
            expect(buildControlIdentity({
                source: 'local', domain: 'Local', controlName: 'seg', title: 'Seg', description: '',
            })).toBeUndefined();
        });

        it('gives same-named entries in different folders distinct keys', () => {
            const dev: ControlBrowseEntry = { ...hubEntry, hubId: 'aws/dev/seg', tags: { path: 'aws/dev' } };
            expect(entryKey(hubEntry)).not.toBe(entryKey(dev));
        });
    });

    describe('path groups', () => {
        const entry = (id: string, path?: string): ControlBrowseEntry => ({
            source: 'hub', domain: 'security', controlName: 'seg', hubId: id,
            ...(path ? { tags: { path } } : {}), title: id, description: '',
        });

        it('groups by path and puts untagged entries in Ungrouped', () => {
            const groups = groupByPath([
                entry('prod', 'aws/prod'), entry('dev', 'aws/dev'),
                entry('other', 'aws/prod'), entry('local'),
            ]);
            expect(groups.map((g) => g.label)).toEqual(['aws/prod', 'aws/dev', 'Ungrouped']);
            expect(groups[0].controls.map((c) => c.hubId)).toEqual(['prod', 'other']);
            expect(groups[2].controls).toHaveLength(1);
        });

        it('does not split by variant', () => {
            const groups = groupByPath([
                { ...entry('md'), tags: { path: 'aws/prod', variant: 'markdown' } },
                { ...entry('json'), tags: { path: 'aws/prod', variant: 'json' } },
            ]);
            expect(groups).toHaveLength(1);
            expect(groups[0].controls).toHaveLength(2);
        });
    });
});
