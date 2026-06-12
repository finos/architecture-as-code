import { describe, it, expect } from 'vitest';
import { constructDocumentId, DocumentMetadata, parseDocumentId, extractDocumentMetadata, updateDocumentId } from './document-id-utils';

describe('Document ID Utils', () => {
    describe('parseDocumentId', () => {
        it('should extract metadata from a valid document ID without version', () => {
            const documentId = 'https://example.com/calm/namespaces/my-namespace/mappings/my-mapping';
            const metadata = parseDocumentId(documentId);
            expect(metadata).toEqual({
                rawDocumentId: documentId,
                baseUrl: 'https://example.com',
                namespace: 'my-namespace',
                mapping: 'my-mapping'
            });
        });

        it('should extract metadata from a valid document ID with version', () => {
            const documentId = 'https://example.com/calm/namespaces/my-namespace/mappings/my-mapping/versions/1.0.0';
            const metadata = parseDocumentId(documentId);
            expect(metadata).toEqual({
                rawDocumentId: documentId,
                baseUrl: 'https://example.com',
                namespace: 'my-namespace',
                mapping: 'my-mapping',
                version: '1.0.0'
            });
        });

        it('should throw an error for an invalid document ID', () => {
            const invalidDocumentId = 'invalid-document-id';
            expect(() => parseDocumentId(invalidDocumentId)).toThrowError(`Invalid document ID format: ${invalidDocumentId}`);
        });
    });

    describe('constructDocumentId', () => {
        it('should construct a document ID without version from metadata', () => {
            const metadata: DocumentMetadata = {
                rawDocumentId: 'https://example.com/calm/namespaces/my-namespace/mappings/my-mapping',
                baseUrl: 'https://example.com',
                namespace: 'my-namespace',
                mapping: 'my-mapping'
            };
            const documentId = constructDocumentId(metadata);
            expect(documentId).toBe('https://example.com/calm/namespaces/my-namespace/mappings/my-mapping');
        });
        it('should construct a document ID with version from metadata', () => {
            const metadata: DocumentMetadata = {
                rawDocumentId: 'https://example.com/calm/namespaces/my-namespace/mappings/my-mapping/versions/1.0.0',
                baseUrl: 'https://example.com',
                namespace: 'my-namespace',
                mapping: 'my-mapping',
                version: '1.0.0'
            };
            const documentId = constructDocumentId(metadata);
            expect(documentId).toBe('https://example.com/calm/namespaces/my-namespace/mappings/my-mapping/versions/1.0.0');
        });

        it('should throw an error if metadata is missing required fields', () => {
            const incompleteMetadata: DocumentMetadata = {
                rawDocumentId: 'https://example.com/calm/namespaces/my-namespace/mappings/my-mapping',
                baseUrl: 'https://example.com',
                mapping: 'my-mapping'
                // namespace is missing
            };
            expect(() => constructDocumentId(incompleteMetadata))
                .toThrow();
        });
    });

    describe('extractDocumentMetadata', () => {
        it('should parse document metadata from a valid JSON document', () => {
            const document = JSON.stringify({
                '$id': 'https://example.com/calm/namespaces/my-namespace/mappings/my-mapping/versions/1.0.0'
            });
            const metadata = extractDocumentMetadata(document);
            expect(metadata).toEqual({
                rawDocumentId: 'https://example.com/calm/namespaces/my-namespace/mappings/my-mapping/versions/1.0.0',
                baseUrl: 'https://example.com',
                namespace: 'my-namespace',
                mapping: 'my-mapping',
                version: '1.0.0'
            });
        });

        it('should throw an error if the document is not valid JSON', () => {
            const invalidDocument = 'not a json';
            expect(() => extractDocumentMetadata(invalidDocument)).toThrow();
        });

        it('should throw an error if the document does not contain a valid $id field', () => {
            const document = JSON.stringify({
                name: 'Test Document'
            });
            expect(() => extractDocumentMetadata(document)).toThrow();
        });
    });

    describe('updateDocumentId', () => {
        it('should update the $id field in the document with a new document ID, without touching other fields', () => {
            const originalDocument = JSON.stringify({
                '$id': 'https://example.com/calm/namespaces/my-namespace/mappings/my-mapping/versions/1.0.0',
                name: 'Test Document'
            }, null, 2);
            const newMetadata: DocumentMetadata = {
                rawDocumentId: 'https://example.com/calm/namespaces/my-namespace/mappings/my-mapping/versions/2.0.0',
                baseUrl: 'https://example.com',
                namespace: 'my-namespace',
                mapping: 'my-mapping',
                version: '2.0.0'
            };
            const updatedDocument = updateDocumentId(originalDocument, newMetadata);
            const expectedDocument = JSON.stringify({
                '$id': 'https://example.com/calm/namespaces/my-namespace/mappings/my-mapping/versions/2.0.0',
                name: 'Test Document'
            }, null, 2);
            expect(updatedDocument).toBe(expectedDocument);
        });
    });
});
