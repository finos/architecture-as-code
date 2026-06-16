import { isValidResourceType, ResourceType } from './calm-hub-client';

// Namespace documents: namespace-scoped
//
// This is essentially all resources except control requirements/configurations.
// Addressed by their namespace, type and mapping slug/id.
// $id encodes the full versioned path served by the User Facing controls API:
//   $BASE_URL/calm/namespaces/$NAMESPACE/$TYPE/$MAPPING_ID/versions/$VERSION

const NAMESPACE_RESOURCE_ID_PATTERN = /^(.*)\/calm\/namespaces\/([^/]+)\/([^/]+)\/([^/]+)\/versions\/([^/]+)$/;
export interface DocumentMetadata extends DocumentIdMetadata {
    name: string; // pulled from 'title'. Required.
    description?: string; // pulled from 'description' if present. When writing back description is set to '' if absent.
}

interface DocumentIdMetadata {
    rawDocumentId: string; // The original document ID as provided in the input file, if any
    namespace?: string; // namespace extracted from the document ID. May be absent, if this is a domain-scoped resource
    mapping: string; // mapping name extracted from the document ID
    baseUrl: string; // Optional base URL extracted from the document ID, if needed for constructing the full document ID
    type: ResourceType;
    version: string; 
}

// Control documents (domain-scoped)
//
// Control requirement and configuration documents are addressed by domain + control
// name (and config name for configurations) rather than namespace + mapping. Their
// $id encodes the full versioned path served by the User Facing controls API:
//   requirement:    $BASE_URL/calm/domains/$DOMAIN/controls/$CONTROL/requirement/versions/$VERSION
//   configuration:  $BASE_URL/calm/domains/$DOMAIN/controls/$CONTROL/configurations/$CONFIG/versions/$VERSION
export type ControlDocumentKind = 'requirement' | 'configuration';

const CONTROL_REQUIREMENT_ID        = /^(.*)\/calm\/domains\/([^/]+)\/controls\/([^/]+)\/requirement\/versions\/([^/]+)$/;
const CONTROL_CONFIGURATION_ID      = /^(.*)\/calm\/domains\/([^/]+)\/controls\/([^/]+)\/configurations\/([^/]+)\/versions\/([^/]+)$/;

export interface ControlDocumentMetadata {
    rawDocumentId: string;
    baseUrl: string;
    domain: string;
    controlName: string;
    configName?: string; // present only for configuration documents
    kind: ControlDocumentKind;
    version: string;
}
function parseDocumentId(documentId: string): DocumentIdMetadata {
    const matches = NAMESPACE_RESOURCE_ID_PATTERN.exec(documentId);
    if (matches) {
        if (!isValidResourceType(matches[3])) {
            throw new Error('Invalid resource type: ' + matches[3]);
        }
        return {
            rawDocumentId: matches[0],
            baseUrl: matches[1],
            namespace: matches[2],
            type: matches[3],
            mapping: matches[4],
            version: matches[5]
        };
    }
    throw new Error(`Invalid document ID format: ${documentId}`);
}

export function constructDocumentId(metadata: DocumentMetadata): string {
    if (!metadata.namespace || !metadata.mapping) {
        throw new Error('Invalid document $id format. Document ID must be of the form $BASE_URL/calm/namespaces/$NAMESPACE/$TYPE/$MAPPING_ID/versions/$VERSION');
    }
    return `${metadata.baseUrl}/calm/namespaces/${metadata.namespace}/${metadata.type}/${metadata.mapping}/versions/${metadata.version}`;
}

export function extractDocumentMetadata(document: string): DocumentMetadata {
    try {
        const json = JSON.parse(document);
        const documentId = json['$id'];
        if (typeof documentId !== 'string') {
            throw new Error('Document does not contain a valid \'$id\' field');
        }
        const idMetadata = parseDocumentId(documentId);
        const name = json['title'];
        if (!name) {
            throw new Error('Missing name field in parsed document.');
        }
        const description = json['description'];
        return {
            ...idMetadata,
            name,
            description
        };
    } catch (error) {
        throw new Error(`Failed to parse document metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function updateDocumentMetadata(document: string, newDocumentMetadata: DocumentMetadata): string {
    try {
        const newDocumentId = constructDocumentId(newDocumentMetadata);
        const json = JSON.parse(document);
        json['$id'] = newDocumentId;
        json['title'] = newDocumentMetadata.name;
        json['description'] = newDocumentMetadata.description ?? '';
        return JSON.stringify(json, null, 2);
    } catch (error) {
        throw new Error(`Failed to parse document metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
}



function parseControlDocumentId(documentId: string): ControlDocumentMetadata {
    const configMatch = CONTROL_CONFIGURATION_ID.exec(documentId);
    if (configMatch) {
        return {
            rawDocumentId: configMatch[0],
            baseUrl: configMatch[1],
            domain: configMatch[2],
            controlName: configMatch[3],
            configName: configMatch[4],
            kind: 'configuration',
            version: configMatch[5]
        };
    }
    const requirementMatch = CONTROL_REQUIREMENT_ID.exec(documentId);
    if (requirementMatch) {
        return {
            rawDocumentId: requirementMatch[0],
            baseUrl: requirementMatch[1],
            domain: requirementMatch[2],
            controlName: requirementMatch[3],
            kind: 'requirement',
            version: requirementMatch[4]
        };
    }
    throw new Error(`Invalid control document ID format: ${documentId}`);
}

export function constructControlDocumentId(metadata: ControlDocumentMetadata): string {
    const base = `${metadata.baseUrl}/calm/domains/${metadata.domain}/controls/${metadata.controlName}`;
    if (metadata.kind === 'configuration') {
        if (!metadata.configName) {
            throw new Error('Invalid control document $id format. Configuration documents require a configName.');
        }
        return `${base}/configurations/${metadata.configName}/versions/${metadata.version}`;
    }
    return `${base}/requirement/versions/${metadata.version}`;
}

export function extractControlMetadata(document: string): ControlDocumentMetadata {
    try {
        const json = JSON.parse(document);
        const documentId = json['$id'];
        if (typeof documentId !== 'string') {
            throw new Error('Document does not contain a valid \'$id\' field');
        }
        return parseControlDocumentId(documentId);
    } catch (error) {
        throw new Error(`Failed to parse control document metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function updateControlDocumentMetadata(document: string, newMetadata: ControlDocumentMetadata): string {
    try {
        const newDocumentId = constructControlDocumentId(newMetadata);
        const json = JSON.parse(document);
        json['$id'] = newDocumentId;
        return JSON.stringify(json, null, 2);
    } catch (error) {
        throw new Error(`Failed to parse control document metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export class DocumentMetadataValidationError extends Error {
    constructor(
        public component: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        public expected?: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        public actual?: any
    ) {
        super(`Document metadata does not match the specified ${component}. Expected ${expected}, got ${actual}`);
        this.name = 'DocumentMetadataError';
    }
}

/**
 * Validate a document metadata against an expected form.
 * @param expectedMetadata The metadata to check against.
 * @param actualMetadata The metadata to validate.
 */
export function validateDocumentId(expectedMetadata: DocumentMetadata, actualMetadata: DocumentMetadata): void {
    for (const key of Object.keys(expectedMetadata)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expected = (expectedMetadata as any)[key];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actual = (actualMetadata as any)[key];
        if (expected !== actual) {
            throw new DocumentMetadataValidationError(key, expected, actual);
        }
    }
}