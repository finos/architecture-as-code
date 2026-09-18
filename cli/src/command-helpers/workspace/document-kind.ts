import {
    isNarrativeDocumentType,
    isValidCalmDocumentType,
    type CalmDocumentType,
    type NarrativeDocumentType,
} from '@finos/calm-models/types';
import type {
    MappingWorkspaceManifestEntry,
    NarrativeWorkspaceManifestEntry,
    WorkspaceManifest,
    WorkspaceManifestEntry,
} from './bundle';

export const WORKSPACE_DOCUMENT_HANDLERS = {
    mapping: {
        kind: 'mapping',
        format: 'json',
        unreadableFile: 'warn',
        supportsJsonReferences: true,
    },
    narrative: {
        kind: 'narrative',
        format: 'markdown',
        unreadableFile: 'fail',
        supportsJsonReferences: false,
    },
} as const;

export type WorkspaceDocumentHandler =
    typeof WORKSPACE_DOCUMENT_HANDLERS[keyof typeof WORKSPACE_DOCUMENT_HANDLERS];
export type WorkspaceDocumentKind = keyof typeof WORKSPACE_DOCUMENT_HANDLERS;

export type ResolvedWorkspaceDocumentType =
    | { kind: 'mapping'; handler: typeof WORKSPACE_DOCUMENT_HANDLERS.mapping; type: CalmDocumentType | 'unknown' }
    | { kind: 'narrative'; handler: typeof WORKSPACE_DOCUMENT_HANDLERS.narrative; type: NarrativeDocumentType };

export type ResolvedWorkspaceManifestEntry =
    | { kind: 'mapping'; handler: typeof WORKSPACE_DOCUMENT_HANDLERS.mapping; entry: MappingWorkspaceManifestEntry }
    | { kind: 'narrative'; handler: typeof WORKSPACE_DOCUMENT_HANDLERS.narrative; entry: NarrativeWorkspaceManifestEntry };

export type WorkspaceDocumentTypeOperations<TResult, TArgs extends unknown[] = []> = {
    [K in WorkspaceDocumentKind]: (
        type: Extract<ResolvedWorkspaceDocumentType, { kind: K }>['type'],
        ...args: TArgs
    ) => TResult;
};

export type WorkspaceManifestEntryOperations<TResult, TArgs extends unknown[] = []> = {
    [K in WorkspaceDocumentKind]: (
        entry: Extract<ResolvedWorkspaceManifestEntry, { kind: K }>['entry'],
        ...args: TArgs
    ) => TResult;
};

/** Resolve only explicitly supported workspace types plus the legacy literal `unknown`. */
export function resolveWorkspaceDocumentType(type: unknown): ResolvedWorkspaceDocumentType | undefined {
    if (typeof type !== 'string') return undefined;
    if (isValidCalmDocumentType(type) || type === 'unknown') {
        return { kind: 'mapping', handler: WORKSPACE_DOCUMENT_HANDLERS.mapping, type };
    }
    if (isNarrativeDocumentType(type)) {
        return { kind: 'narrative', handler: WORKSPACE_DOCUMENT_HANDLERS.narrative, type };
    }
    return undefined;
}

export function isNarrativeWorkspaceManifestEntry(
    entry: WorkspaceManifestEntry
): entry is NarrativeWorkspaceManifestEntry {
    return resolveWorkspaceDocumentType(entry.type)?.kind === 'narrative';
}

export function resolveWorkspaceManifestEntry(
    entry: WorkspaceManifestEntry
): ResolvedWorkspaceManifestEntry {
    if (isNarrativeWorkspaceManifestEntry(entry)) {
        return { kind: 'narrative', handler: WORKSPACE_DOCUMENT_HANDLERS.narrative, entry };
    }
    if (resolveWorkspaceDocumentType(entry.type)?.kind !== 'mapping') {
        throw new Error(`Unsupported workspace document type '${String(entry.type)}'.`);
    }
    return { kind: 'mapping', handler: WORKSPACE_DOCUMENT_HANDLERS.mapping, entry };
}

export function dispatchWorkspaceDocumentType<TResult, TArgs extends unknown[]>(
    document: ResolvedWorkspaceDocumentType,
    operations: WorkspaceDocumentTypeOperations<TResult, TArgs>,
    ...args: TArgs
): TResult {
    switch (document.kind) {
    case 'mapping':
        return operations.mapping(document.type, ...args);
    case 'narrative':
        return operations.narrative(document.type, ...args);
    default:
        return assertNever(document);
    }
}

export function dispatchWorkspaceManifestEntry<TResult, TArgs extends unknown[]>(
    document: ResolvedWorkspaceManifestEntry,
    operations: WorkspaceManifestEntryOperations<TResult, TArgs>,
    ...args: TArgs
): TResult {
    switch (document.kind) {
    case 'mapping':
        return operations.mapping(document.entry, ...args);
    case 'narrative':
        return operations.narrative(document.entry, ...args);
    default:
        return assertNever(document);
    }
}

/** Keep non-JSON workspace documents out of mapping reference reads and rewrites. */
export function getJsonReferenceWorkspaceManifest(manifest: WorkspaceManifest): WorkspaceManifest {
    const result: WorkspaceManifest = {};
    for (const [id, entry] of Object.entries(manifest)) {
        const resolved = resolveWorkspaceManifestEntry(entry);
        if (resolved.handler.supportsJsonReferences) {
            result[id] = resolved.entry;
        }
    }
    return result;
}

function assertNever(value: never): never {
    throw new Error(`Unsupported workspace document kind '${String(value)}'.`);
}
