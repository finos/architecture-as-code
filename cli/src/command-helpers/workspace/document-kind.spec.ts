import {
    dispatchWorkspaceManifestEntry,
    getJsonReferenceWorkspaceManifest,
    resolveWorkspaceDocumentType,
    resolveWorkspaceManifestEntry,
    WORKSPACE_DOCUMENT_HANDLERS,
    type WorkspaceManifestEntryOperations,
} from './document-kind';
import type { WorkspaceManifest, WorkspaceManifestEntry } from './bundle';
import {
    CALM_DOCUMENT_TYPES_LIST,
    CALM_NARRATIVE_DOCUMENT_TYPES_LIST,
} from '@finos/calm-models/types';

describe('workspace document handlers', () => {
    it('resolves mapping and narrative entries through the central handler record', () => {
        const mapping: WorkspaceManifestEntry = { path: 'architecture.json', type: 'architecture' };
        const narrative: WorkspaceManifestEntry = {
            path: 'decision.md',
            type: 'sad',
            namespace: 'example',
            version: '1.0.0',
        };

        expect(resolveWorkspaceManifestEntry(mapping)).toEqual({
            kind: 'mapping',
            handler: WORKSPACE_DOCUMENT_HANDLERS.mapping,
            entry: mapping,
        });
        expect(resolveWorkspaceManifestEntry(narrative)).toEqual({
            kind: 'narrative',
            handler: WORKSPACE_DOCUMENT_HANDLERS.narrative,
            entry: narrative,
        });
        expect(resolveWorkspaceDocumentType('architecture')?.handler).toBe(WORKSPACE_DOCUMENT_HANDLERS.mapping);
        expect(resolveWorkspaceDocumentType('sad')?.handler).toBe(WORKSPACE_DOCUMENT_HANDLERS.narrative);
    });

    it('intentionally retains mapping behavior for the legacy unknown type', () => {
        const unknown: WorkspaceManifestEntry = { path: 'legacy.json', type: 'unknown' };

        expect(resolveWorkspaceManifestEntry(unknown)).toEqual({
            kind: 'mapping',
            handler: WORKSPACE_DOCUMENT_HANDLERS.mapping,
            entry: unknown,
        });
        expect(resolveWorkspaceDocumentType('unknown')?.handler).toBe(WORKSPACE_DOCUMENT_HANDLERS.mapping);
    });

    it('does not assign unsupported future types to the mapping strategy', () => {
        expect(resolveWorkspaceDocumentType('future-document-kind')).toBeUndefined();
    });

    it('keeps the handler table exhaustive for every classified document kind', () => {
        const resolvedKinds = [...CALM_DOCUMENT_TYPES_LIST, ...CALM_NARRATIVE_DOCUMENT_TYPES_LIST]
            .map(type => resolveWorkspaceDocumentType(type)?.kind);

        expect(new Set(resolvedKinds)).toEqual(new Set(Object.keys(WORKSPACE_DOCUMENT_HANDLERS)));
        expect(resolvedKinds).not.toContain(undefined);
    });

    it('selects only handlers that support JSON reference processing', () => {
        const manifest: WorkspaceManifest = {
            architecture: { path: 'architecture.json', type: 'architecture' },
            decision: {
                path: 'decision.md',
                type: 'sad',
                namespace: 'example',
                version: '1.0.0',
            },
        };

        expect(getJsonReferenceWorkspaceManifest(manifest)).toEqual({
            architecture: manifest.architecture,
        });
    });

    it('dispatches every registered kind through an exhaustive operation table', () => {
        const operations = {
            mapping: entry => `mapping:${entry.type}`,
            narrative: entry => `narrative:${entry.type}`,
        } satisfies WorkspaceManifestEntryOperations<string>;

        const mapping = resolveWorkspaceManifestEntry({ path: 'architecture.json', type: 'architecture' });
        const narrative = resolveWorkspaceManifestEntry({
            path: 'decision.md',
            type: 'sad',
            namespace: 'example',
            version: '1.0.0',
        });

        expect(dispatchWorkspaceManifestEntry(mapping, operations)).toBe('mapping:architecture');
        expect(dispatchWorkspaceManifestEntry(narrative, operations)).toBe('narrative:sad');
    });
});
