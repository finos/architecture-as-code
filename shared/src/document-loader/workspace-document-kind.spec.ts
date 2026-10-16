import {
    CALM_DOCUMENT_TYPES_LIST,
    CALM_NARRATIVE_DOCUMENT_TYPES_LIST,
} from '@finos/calm-models/types';
import {
    classifyWorkspaceDocumentType,
    getWorkspaceDocumentLoadPolicy,
} from './workspace-document-kind';

describe('workspace document kind', () => {
    it.each(CALM_DOCUMENT_TYPES_LIST)('assigns mapping type %s to the JSON loader policy', (type) => {
        expect(classifyWorkspaceDocumentType(type)).toEqual({ kind: 'mapping', type });
        expect(getWorkspaceDocumentLoadPolicy(type)).toBe('json');
    });

    it.each(CALM_NARRATIVE_DOCUMENT_TYPES_LIST)('assigns narrative type %s to the non-JSON loader policy', (type) => {
        expect(classifyWorkspaceDocumentType(type)).toEqual({ kind: 'narrative', type });
        expect(getWorkspaceDocumentLoadPolicy(type)).toBe('non-json');
    });

    it('retains the JSON loader policy for the legacy unknown type', () => {
        expect(classifyWorkspaceDocumentType('unknown')).toEqual({ kind: 'mapping', type: 'unknown' });
        expect(getWorkspaceDocumentLoadPolicy('unknown')).toBe('json');
    });

    it('does not assign a loader policy to an unsupported future type', () => {
        expect(classifyWorkspaceDocumentType('future-document-kind')).toBeUndefined();
        expect(getWorkspaceDocumentLoadPolicy('future-document-kind')).toBeUndefined();
    });
});
