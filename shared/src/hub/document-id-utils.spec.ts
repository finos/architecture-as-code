import { describe, it, expect } from 'vitest';
import {
    constructDocumentId,
    DocumentMetadata,
    extractDocumentMetadata,
    updateDocumentMetadata,
    validateDocumentId,
    DocumentMetadataValidationError,
    ControlDocumentMetadata,
    constructControlDocumentId,
    extractControlMetadata,
    updateControlDocumentMetadata
} from './document-id-utils';

const DOCUMENT_ID = 'https://example.com/calm/namespaces/finos/architectures/my-arch/versions/1.0.0';

function fullMetadata(overrides: Partial<DocumentMetadata> = {}): DocumentMetadata {
    return {
        rawDocumentId: DOCUMENT_ID,
        baseUrl: 'https://example.com',
        namespace: 'finos',
        mapping: 'my-arch',
        type: 'architectures',
        version: '1.0.0',
        name: 'My Arch',
        description: 'A test architecture',
        ...overrides
    };
}

describe('Document ID Utils', () => {
    describe('constructDocumentId', () => {
        it('builds a versioned, type-scoped document ID from metadata', () => {
            expect(constructDocumentId(fullMetadata())).toBe(DOCUMENT_ID);
        });

        it('uses the type and version from the metadata', () => {
            const id = constructDocumentId(fullMetadata({ type: 'patterns', mapping: 'my-pattern', version: '2.3.4' }));
            expect(id).toBe('https://example.com/calm/namespaces/finos/patterns/my-pattern/versions/2.3.4');
        });

        it('throws when the namespace is missing', () => {
            const metadata = fullMetadata();
            delete (metadata as Partial<DocumentMetadata>).namespace;
            expect(() => constructDocumentId(metadata)).toThrow(/Invalid document \$id format/);
        });

        it('throws when the mapping is missing', () => {
            const metadata = fullMetadata();
            delete (metadata as Partial<DocumentMetadata>).mapping;
            expect(() => constructDocumentId(metadata)).toThrow(/Invalid document \$id format/);
        });
    });

    describe('extractDocumentMetadata', () => {
        it('extracts metadata from a valid document including the title and description', () => {
            const document = JSON.stringify({
                $id: DOCUMENT_ID,
                title: 'My Arch',
                description: 'A test architecture'
            });
            expect(extractDocumentMetadata(document)).toEqual({
                rawDocumentId: DOCUMENT_ID,
                baseUrl: 'https://example.com',
                namespace: 'finos',
                type: 'architectures',
                mapping: 'my-arch',
                version: '1.0.0',
                name: 'My Arch',
                description: 'A test architecture'
            });
        });

        it('leaves the description undefined when the document has none', () => {
            const document = JSON.stringify({ $id: DOCUMENT_ID, title: 'My Arch' });
            const metadata = extractDocumentMetadata(document);
            expect(metadata.description).toBeUndefined();
            expect(metadata.name).toBe('My Arch');
        });

        it('throws when the document is not valid JSON', () => {
            expect(() => extractDocumentMetadata('not json')).toThrow(/Failed to parse document metadata/);
        });

        it('throws when the document has no $id field', () => {
            const document = JSON.stringify({ title: 'My Arch' });
            expect(() => extractDocumentMetadata(document)).toThrow(/Document does not contain a valid '\$id' field/);
        });

        it('throws when the $id does not match the expected format', () => {
            const document = JSON.stringify({ $id: 'https://example.com/not-a-calm-id', title: 'My Arch' });
            expect(() => extractDocumentMetadata(document)).toThrow(/Invalid document ID format/);
        });

        it('throws when the $id contains an unknown resource type', () => {
            const document = JSON.stringify({
                $id: 'https://example.com/calm/namespaces/finos/widgets/my-arch/versions/1.0.0',
                title: 'My Arch'
            });
            expect(() => extractDocumentMetadata(document)).toThrow(/Invalid resource type: widgets/);
        });

        it('throws when the title is missing', () => {
            const document = JSON.stringify({ $id: DOCUMENT_ID });
            expect(() => extractDocumentMetadata(document)).toThrow(/Missing name field in parsed document/);
        });
    });

    describe('updateDocumentMetadata', () => {
        it('rewrites $id, title and description while preserving other fields', () => {
            const original = JSON.stringify({
                $id: DOCUMENT_ID,
                title: 'Old Title',
                description: 'Old description',
                nodes: [{ 'unique-id': 'node-a' }]
            });
            const updated = updateDocumentMetadata(original, fullMetadata({ version: '2.0.0', name: 'New Title', description: 'New description' }));
            expect(JSON.parse(updated)).toEqual({
                $id: 'https://example.com/calm/namespaces/finos/architectures/my-arch/versions/2.0.0',
                title: 'New Title',
                description: 'New description',
                nodes: [{ 'unique-id': 'node-a' }]
            });
        });

        it('defaults the description to an empty string when the metadata has none', () => {
            const original = JSON.stringify({ $id: DOCUMENT_ID, title: 'My Arch' });
            const updated = updateDocumentMetadata(original, fullMetadata({ description: undefined }));
            expect(JSON.parse(updated).description).toBe('');
        });

        it('pretty-prints the updated document with two-space indentation', () => {
            const original = JSON.stringify({ $id: DOCUMENT_ID, title: 'My Arch' });
            const updated = updateDocumentMetadata(original, fullMetadata());
            expect(updated).toContain('\n  "$id"');
        });

        it('throws when the metadata cannot produce a valid document ID', () => {
            const metadata = fullMetadata();
            delete (metadata as Partial<DocumentMetadata>).namespace;
            const original = JSON.stringify({ $id: DOCUMENT_ID, title: 'My Arch' });
            expect(() => updateDocumentMetadata(original, metadata)).toThrow(/Failed to parse document metadata/);
        });

        it('throws when the document is not valid JSON', () => {
            expect(() => updateDocumentMetadata('not json', fullMetadata())).toThrow(/Failed to parse document metadata/);
        });
    });

    describe('validateDocumentId', () => {
        const expected = fullMetadata();

        it('does not throw when actual matches expected on every key', () => {
            expect(() => validateDocumentId(expected, { ...expected })).not.toThrow();
        });

        it('does not throw when expected has no keys', () => {
            expect(() => validateDocumentId({} as DocumentMetadata, { ...expected })).not.toThrow();
        });

        it('ignores keys present only on the actual metadata', () => {
            const actual = { ...expected, somethingExtra: 'ignored' } as DocumentMetadata;
            expect(() => validateDocumentId(expected, actual)).not.toThrow();
        });

        it('throws a DocumentMetadataValidationError when a field differs', () => {
            const actual = { ...expected, version: '2.0.0' };
            expect(() => validateDocumentId(expected, actual)).toThrow(DocumentMetadataValidationError);
        });

        it('reports the mismatching component with its expected and actual values', () => {
            const actual = { ...expected, namespace: 'workshop' };
            try {
                validateDocumentId(expected, actual);
                throw new Error('expected validateDocumentId to throw');
            } catch (err) {
                expect(err).toBeInstanceOf(DocumentMetadataValidationError);
                const validationError = err as DocumentMetadataValidationError;
                expect(validationError.component).toBe('namespace');
                expect(validationError.expected).toBe('finos');
                expect(validationError.actual).toBe('workshop');
                expect(validationError.name).toBe('DocumentMetadataError');
                expect(validationError.message).toBe(
                    'Document metadata does not match the specified namespace. Expected finos, got workshop'
                );
            }
        });

        it('throws when the actual metadata is missing a key present on expected', () => {
            const actual = { ...expected };
            delete (actual as Partial<DocumentMetadata>).description;
            expect(() => validateDocumentId(expected, actual)).toThrow(
                'Document metadata does not match the specified description. Expected A test architecture, got undefined'
            );
        });

        it('reports the first mismatching component when several differ', () => {
            const actual = { ...expected, namespace: 'workshop', version: '2.0.0' };
            try {
                validateDocumentId(expected, actual);
                throw new Error('expected validateDocumentId to throw');
            } catch (err) {
                // namespace precedes version in the metadata key order, so it is reported first
                expect((err as DocumentMetadataValidationError).component).toBe('namespace');
            }
        });
    });

    describe('control documents', () => {
        const REQUIREMENT_ID = 'https://example.com/calm/domains/security/controls/access-control/requirement/versions/1.0.0';
        const CONFIGURATION_ID = 'https://example.com/calm/domains/security/controls/access-control/configurations/prod/versions/1.0.0';

        describe('extractControlMetadata', () => {
            it('parses a requirement document $id', () => {
                const document = JSON.stringify({ $id: REQUIREMENT_ID, nodes: [] });
                expect(extractControlMetadata(document)).toEqual({
                    rawDocumentId: REQUIREMENT_ID,
                    baseUrl: 'https://example.com',
                    domain: 'security',
                    controlName: 'access-control',
                    kind: 'requirement',
                    version: '1.0.0'
                });
            });

            it('parses a configuration document $id including the config name', () => {
                const document = JSON.stringify({ $id: CONFIGURATION_ID, nodes: [] });
                expect(extractControlMetadata(document)).toEqual({
                    rawDocumentId: CONFIGURATION_ID,
                    baseUrl: 'https://example.com',
                    domain: 'security',
                    controlName: 'access-control',
                    configName: 'prod',
                    kind: 'configuration',
                    version: '1.0.0'
                });
            });

            it('throws when the document has no $id', () => {
                expect(() => extractControlMetadata(JSON.stringify({ nodes: [] }))).toThrow(/Document does not contain a valid '\$id' field/);
            });

            it('throws when the $id is not a control document ID', () => {
                const document = JSON.stringify({ $id: 'https://example.com/calm/namespaces/finos/architectures/a/versions/1.0.0' });
                expect(() => extractControlMetadata(document)).toThrow(/Invalid control document ID format/);
            });

            it('throws when the document is not valid JSON', () => {
                expect(() => extractControlMetadata('not json')).toThrow(/Failed to parse control document metadata/);
            });
        });

        describe('constructControlDocumentId', () => {
            it('builds a requirement document ID', () => {
                const metadata: ControlDocumentMetadata = {
                    rawDocumentId: REQUIREMENT_ID,
                    baseUrl: 'https://example.com',
                    domain: 'security',
                    controlName: 'access-control',
                    kind: 'requirement',
                    version: '2.0.0'
                };
                expect(constructControlDocumentId(metadata)).toBe('https://example.com/calm/domains/security/controls/access-control/requirement/versions/2.0.0');
            });

            it('builds a configuration document ID', () => {
                const metadata: ControlDocumentMetadata = {
                    rawDocumentId: CONFIGURATION_ID,
                    baseUrl: 'https://example.com',
                    domain: 'security',
                    controlName: 'access-control',
                    configName: 'prod',
                    kind: 'configuration',
                    version: '2.0.0'
                };
                expect(constructControlDocumentId(metadata)).toBe('https://example.com/calm/domains/security/controls/access-control/configurations/prod/versions/2.0.0');
            });

            it('throws when a configuration document has no config name', () => {
                const metadata = {
                    rawDocumentId: CONFIGURATION_ID,
                    baseUrl: 'https://example.com',
                    domain: 'security',
                    controlName: 'access-control',
                    kind: 'configuration',
                    version: '2.0.0'
                } as ControlDocumentMetadata;
                expect(() => constructControlDocumentId(metadata)).toThrow(/require a configName/);
            });
        });

        describe('updateControlDocumentMetadata', () => {
            it('rewrites the $id with the new version while preserving other fields', () => {
                const original = JSON.stringify({ $id: REQUIREMENT_ID, nodes: [{ 'unique-id': 'n' }] });
                const updated = updateControlDocumentMetadata(original, {
                    rawDocumentId: REQUIREMENT_ID,
                    baseUrl: 'https://example.com',
                    domain: 'security',
                    controlName: 'access-control',
                    kind: 'requirement',
                    version: '2.0.0'
                });
                expect(JSON.parse(updated)).toEqual({
                    $id: 'https://example.com/calm/domains/security/controls/access-control/requirement/versions/2.0.0',
                    nodes: [{ 'unique-id': 'n' }]
                });
            });

            it('throws when the document is not valid JSON', () => {
                expect(() => updateControlDocumentMetadata('not json', {
                    rawDocumentId: REQUIREMENT_ID,
                    baseUrl: 'https://example.com',
                    domain: 'security',
                    controlName: 'access-control',
                    kind: 'requirement',
                    version: '2.0.0'
                })).toThrow(/Failed to parse control document metadata/);
            });
        });
    });
});
