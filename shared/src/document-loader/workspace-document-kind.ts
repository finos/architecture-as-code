import {
    isNarrativeDocumentType,
    isValidCalmDocumentType,
    type CalmDocumentType,
    type NarrativeDocumentType,
} from '@finos/calm-models/types';

export type WorkspaceDocumentKind = 'mapping' | 'narrative';

export type ClassifiedWorkspaceDocumentType =
    | { kind: 'mapping'; type: CalmDocumentType | 'unknown' }
    | { kind: 'narrative'; type: NarrativeDocumentType };

export const WORKSPACE_DOCUMENT_LOAD_POLICIES = {
    mapping: 'json',
    narrative: 'non-json',
} as const satisfies Record<WorkspaceDocumentKind, 'json' | 'non-json'>;

export type WorkspaceDocumentLoadPolicy =
    typeof WORKSPACE_DOCUMENT_LOAD_POLICIES[WorkspaceDocumentKind];

/** Classify only supported workspace document types and the legacy `unknown` type. */
export function classifyWorkspaceDocumentType(type: unknown): ClassifiedWorkspaceDocumentType | undefined {
    if (typeof type !== 'string') return undefined;
    if (isValidCalmDocumentType(type) || type === 'unknown') {
        return { kind: 'mapping', type };
    }
    if (isNarrativeDocumentType(type)) {
        return { kind: 'narrative', type };
    }
    return undefined;
}

export function getWorkspaceDocumentLoadPolicy(type: unknown): WorkspaceDocumentLoadPolicy | undefined {
    const document = classifyWorkspaceDocumentType(type);
    return document === undefined ? undefined : WORKSPACE_DOCUMENT_LOAD_POLICIES[document.kind];
}
