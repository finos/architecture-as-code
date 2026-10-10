import { describe, it, expect } from 'vitest';
import { documentTypeForContent, documentTypeForDocumentId, resourceTypeForDocumentType } from './document-id-type';

const namespaceId = (type: string) => `https://hub.example.com/calm/namespaces/finos/${type}/my-doc/versions/1.0.0`;

describe('document-id-type', () => {
    describe('documentTypeForDocumentId', () => {
        it.each([
            ['patterns', 'pattern'],
            ['architectures', 'architecture'],
            ['flows', 'flow'],
            ['standards', 'schema'],
            ['interfaces', 'interface'],
        ])('maps a %s $id to the %s document type', (resourceType, documentType) => {
            expect(documentTypeForDocumentId(namespaceId(resourceType))).toBe(documentType);
        });

        it('maps control requirement and configuration ids to control', () => {
            expect(documentTypeForDocumentId('https://hub.example.com/calm/domains/security/controls/ac/requirement/versions/1.0.0')).toBe('control');
            expect(documentTypeForDocumentId('https://hub.example.com/calm/domains/security/controls/ac/configurations/prod/versions/1.0.0')).toBe('control');
        });

        it('returns undefined for an id that is not a conformant CalmHub id', () => {
            expect(documentTypeForDocumentId(namespaceId('adrs'))).toBeUndefined();
            expect(documentTypeForDocumentId('https://calm.finos.org/samples/my-flow.json')).toBeUndefined();
        });
    });

    describe('resourceTypeForDocumentType', () => {
        it('returns the resource type for a document type that has one', () => {
            expect(resourceTypeForDocumentType('flow')).toBe('flows');
            expect(resourceTypeForDocumentType('schema')).toBe('standards');
        });

        it('returns undefined for a document type with no namespace resource type', () => {
            expect(resourceTypeForDocumentType('control')).toBeUndefined();
            expect(resourceTypeForDocumentType('timeline')).toBeUndefined();
        });
    });

    describe('documentTypeForContent', () => {
        it('reads the type from the $id of a JSON document', () => {
            expect(documentTypeForContent(JSON.stringify({ $id: namespaceId('flows'), name: 'My Flow' }))).toBe('flow');
        });

        it('returns undefined for missing content, invalid JSON, or a document with no $id', () => {
            expect(documentTypeForContent(undefined)).toBeUndefined();
            expect(documentTypeForContent('---\ntitle: Payments SAD\n---\n')).toBeUndefined();
            expect(documentTypeForContent(JSON.stringify({ title: 'No id' }))).toBeUndefined();
            expect(documentTypeForContent('null')).toBeUndefined();
        });
    });
});
