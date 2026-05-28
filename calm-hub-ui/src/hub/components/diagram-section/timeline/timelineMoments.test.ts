import { describe, it, expect } from 'vitest';
import type { CalmTimelineSchema, CalmMomentSchema } from '@finos/calm-models/types';
import { versionFromReference, momentsFromTimeline, momentsFromVersions } from './timelineMoments.js';

function moment(overrides: Partial<CalmMomentSchema> & { 'unique-id': string }): CalmMomentSchema {
    return {
        'node-type': 'moment',
        name: overrides['unique-id'],
        description: '',
        ...overrides,
    };
}

describe('versionFromReference', () => {
    it('parses the trailing /versions/{version} segment', () => {
        expect(versionFromReference('/calm/namespaces/finos/architectures/42/versions/1.0.0')).toBe('1.0.0');
    });

    it('parses fully-qualified URLs', () => {
        expect(versionFromReference('https://hub/calm/namespaces/finos/architectures/42/versions/2.3.4')).toBe('2.3.4');
    });

    it('tolerates a trailing slash', () => {
        expect(versionFromReference('/x/versions/9.9.9/')).toBe('9.9.9');
    });

    it('returns undefined when there is no version segment or no reference', () => {
        expect(versionFromReference(undefined)).toBeUndefined();
        expect(versionFromReference('/calm/namespaces/finos/architectures/42')).toBeUndefined();
    });
});

describe('momentsFromTimeline', () => {
    it('builds moments in document order, deriving versions from references', () => {
        const timeline: CalmTimelineSchema = {
            moments: [
                moment({
                    'unique-id': 'genesis',
                    name: 'Genesis',
                    description: 'The first moment',
                    'valid-from': '2025-01-01',
                    adrs: ['/calm/adrs/1'],
                    details: { 'detailed-architecture': '/calm/.../versions/1.0.0' },
                }),
                moment({
                    'unique-id': 'next',
                    name: 'Next',
                    details: { 'detailed-architecture': '/calm/.../versions/2.0.0' },
                }),
            ],
        };
        const result = momentsFromTimeline(timeline);
        expect(result).toEqual([
            { key: 'genesis', label: 'Genesis', version: '1.0.0', description: 'The first moment', validFrom: '2025-01-01', adrs: ['/calm/adrs/1'] },
            { key: 'next', label: 'Next', version: '2.0.0', description: '', validFrom: undefined, adrs: undefined },
        ]);
    });

    it('drops moments whose reference has no derivable version', () => {
        const timeline: CalmTimelineSchema = {
            moments: [
                moment({ 'unique-id': 'a', details: { 'detailed-architecture': '/no/version/here' } }),
                moment({ 'unique-id': 'b', details: { 'detailed-architecture': '/x/versions/3.0.0' } }),
            ],
        };
        expect(momentsFromTimeline(timeline).map((m) => m.version)).toEqual(['3.0.0']);
    });
});

describe('momentsFromVersions', () => {
    it('reverses a newest-first list into oldest-first moments', () => {
        expect(momentsFromVersions(['2.0.0', '1.5.0', '1.0.0'])).toEqual([
            { key: '1.0.0', label: '1.0.0', version: '1.0.0' },
            { key: '1.5.0', label: '1.5.0', version: '1.5.0' },
            { key: '2.0.0', label: '2.0.0', version: '2.0.0' },
        ]);
    });
});
