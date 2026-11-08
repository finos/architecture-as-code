import { describe, it, expect } from 'vitest';
import {
    GITHUB_RESOURCE_DIRECTORIES,
    GITHUB_DIRECTORY_ALIASES,
    isKnownGitHubDirectory,
    canonicalGitHubDirectory,
    detectDirectorySegment,
    classifyGitHubDocument,
} from './github-layout';

describe('github-layout', () => {
    describe('isKnownGitHubDirectory', () => {
        it('identifies canonical directories regardless of casing', () => {
            for (const dir of GITHUB_RESOURCE_DIRECTORIES) {
                expect(isKnownGitHubDirectory(dir)).toBe(true);
                expect(isKnownGitHubDirectory(dir.toUpperCase())).toBe(true);
            }
        });

        it('identifies aliased directories', () => {
            expect(GITHUB_DIRECTORY_ALIASES['standard-nodes']).toBe('standards');
            expect(isKnownGitHubDirectory('standard-nodes')).toBe(true);
            expect(isKnownGitHubDirectory('STANDARD-NODES')).toBe(true);
        });

        it('returns false for unknown directories', () => {
            expect(isKnownGitHubDirectory('unknown')).toBe(false);
            expect(isKnownGitHubDirectory('schemas')).toBe(false);
            expect(isKnownGitHubDirectory('docs')).toBe(false);
        });
    });

    describe('canonicalGitHubDirectory', () => {
        it('resolves canonical directories', () => {
            expect(canonicalGitHubDirectory('architectures')).toBe('architectures');
            expect(canonicalGitHubDirectory('PATTERNS')).toBe('patterns');
            expect(canonicalGitHubDirectory('standards')).toBe('standards');
            expect(canonicalGitHubDirectory('flows')).toBe('flows');
            expect(canonicalGitHubDirectory('interfaces')).toBe('interfaces');
            expect(canonicalGitHubDirectory('controls')).toBe('controls');
            expect(canonicalGitHubDirectory('adrs')).toBe('adrs');
            expect(canonicalGitHubDirectory('timelines')).toBe('timelines');
            expect(canonicalGitHubDirectory('decorators')).toBe('decorators');
        });

        it('resolves standard-nodes alias to standards', () => {
            expect(canonicalGitHubDirectory('standard-nodes')).toBe('standards');
            expect(canonicalGitHubDirectory('STANDARD-NODES')).toBe('standards');
        });

        it('returns undefined for unknown directories', () => {
            expect(canonicalGitHubDirectory('other')).toBeUndefined();
        });
    });

    describe('detectDirectorySegment', () => {
        it('detects direct parent when it is a known directory', () => {
            expect(detectDirectorySegment('architectures/payment.json')).toBe('architectures');
            expect(detectDirectorySegment('patterns/web-app.json')).toBe('patterns');
            expect(detectDirectorySegment('standards/auth.json')).toBe('standards');
            expect(detectDirectorySegment('standard-nodes/block.json')).toBe('standard-nodes');
            expect(detectDirectorySegment('flows/checkout.json')).toBe('flows');
            expect(detectDirectorySegment('interfaces/api.json')).toBe('interfaces');
            expect(detectDirectorySegment('controls/ac-1.json')).toBe('controls');
            expect(detectDirectorySegment('adrs/adr-001.json')).toBe('adrs');
            expect(detectDirectorySegment('timelines/v1.json')).toBe('timelines');
            expect(detectDirectorySegment('decorators/eval.json')).toBe('decorators');
        });

        it('finds known directory segment in nested subdirectories', () => {
            expect(detectDirectorySegment('src/architectures/sub/payment.json')).toBe('architectures');
            expect(detectDirectorySegment('team/a/patterns/nested/web-app.json')).toBe('patterns');
            expect(detectDirectorySegment('deep/path/standard-nodes/item.json')).toBe('standard-nodes');
        });

        it('returns immediate parent when no segment is a known directory', () => {
            expect(detectDirectorySegment('other/payment.json')).toBe('other');
            expect(detectDirectorySegment('nested/custom/payment.json')).toBe('custom');
        });

        it('returns undefined for root files with no directory', () => {
            expect(detectDirectorySegment('payment.json')).toBeUndefined();
            expect(detectDirectorySegment('./payment.json')).toBeUndefined();
        });

        it('handles Windows backslashes', () => {
            expect(detectDirectorySegment('architectures\\sub\\payment.json')).toBe('architectures');
            expect(detectDirectorySegment('misc\\payment.json')).toBe('misc');
        });
    });

    describe('classifyGitHubDocument', () => {
        it('rule 1: classifies timeline from moments or timeline $schema in any directory', () => {
            expect(classifyGitHubDocument({ moments: [] }, 'specs')).toEqual({
                source: 'content',
                directory: 'timelines',
            });
            expect(
                classifyGitHubDocument(
                    { $schema: 'https://calm.finos.org/release/1.3/meta/calm-timeline.json' },
                    'architectures'
                )
            ).toEqual({
                source: 'content',
                directory: 'timelines',
            });
        });

        it('rule 2: classifies documents with nodes or relationships from directory hint (excluding controls and timelines)', () => {
            expect(classifyGitHubDocument({ nodes: [] }, 'architectures')).toEqual({
                source: 'directory',
                directory: 'architectures',
            });
            expect(classifyGitHubDocument({ relationships: [] }, 'patterns')).toEqual({
                source: 'directory',
                directory: 'patterns',
            });
            expect(classifyGitHubDocument({ nodes: [] }, 'standard-nodes')).toEqual({
                source: 'directory',
                directory: 'standards',
            });
            expect(classifyGitHubDocument({ nodes: [] }, 'controls')).toEqual({
                source: 'directory',
                directory: undefined,
            });
            expect(classifyGitHubDocument({ nodes: [] }, 'timelines')).toEqual({
                source: 'directory',
                directory: undefined,
            });
            expect(classifyGitHubDocument({ nodes: [] }, 'specs')).toEqual({
                source: 'directory',
                directory: undefined,
            });
        });

        it('rule 3: classifies flow, interface, control, and decorator from $schema in any directory', () => {
            expect(
                classifyGitHubDocument({ $schema: 'https://calm.finos.org/release/1.2/meta/flow.json' }, 'specs')
            ).toEqual({
                source: 'content',
                directory: 'flows',
            });
            expect(
                classifyGitHubDocument({ $schema: 'https://calm.finos.org/release/1.2/meta/interface.json' }, 'specs')
            ).toEqual({
                source: 'content',
                directory: 'interfaces',
            });
            expect(
                classifyGitHubDocument({ $schema: 'https://calm.finos.org/release/1.2/meta/control.json' }, 'specs')
            ).toEqual({
                source: 'content',
                directory: 'controls',
            });
            expect(
                classifyGitHubDocument({ $schema: 'https://calm.finos.org/release/1.2/meta/decorators.json' }, 'specs')
            ).toEqual({
                source: 'content',
                directory: 'decorators',
            });
        });

        it('rule 4: classifies other documents from directory only across all known directories', () => {
            expect(classifyGitHubDocument({ title: 'Control' }, 'controls')).toEqual({
                source: 'directory',
                directory: 'controls',
            });
            expect(classifyGitHubDocument({ title: 'Timeline' }, 'timelines')).toEqual({
                source: 'directory',
                directory: 'timelines',
            });
            expect(classifyGitHubDocument({ title: 'Standard' }, 'standards')).toEqual({
                source: 'directory',
                directory: 'standards',
            });
            expect(classifyGitHubDocument({ title: 'Unknown' }, 'drafts')).toEqual({
                source: 'directory',
                directory: undefined,
            });
            expect(classifyGitHubDocument(undefined, 'architectures')).toEqual({
                source: 'directory',
                directory: 'architectures',
            });
        });
    });
});

