import { isValidResourceType, ResourceType } from './resource-types.js';

// Namespace documents: namespace-scoped
//
// This is essentially all resources except control requirements/configurations.
// Addressed by their namespace, type and mapping slug/id.
// $id encodes the full versioned path served by the User Facing controls API:
//   $BASE_URL/calm/namespaces/$NAMESPACE/$TYPE/$MAPPING_ID/versions/$VERSION

const NAMESPACE_RESOURCE_ID_PATTERN = /^(.*)\/calm\/namespaces\/([^/]+)\/([^/]+)\/([^/]+)\/versions\/([^/]+)$/;
export interface DocumentMetadata extends DocumentIdMetadata {
    name: string; // pulled from 'title', or from 'name' for a flow. Required.
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

/**
 * Returns true if the given string is a conformant CalmHub document `$id` — either a
 * namespace-resource id or a control requirement/configuration id.
 */
export function isConformantDocumentId(id: string): boolean {
    try {
        parseDocumentId(id);
        return true;
    } catch {
        // not a namespace-resource id; try the control forms
    }
    try {
        parseControlDocumentId(id);
        return true;
    } catch {
        return false;
    }
}

/**
 * Returns the namespace of a namespace-resource document `$id`, or undefined if the id is a
 * control document or is not conformant.
 */
export function namespaceFromDocumentId(id: string): string | undefined {
    try {
        return parseDocumentId(id).namespace;
    } catch {
        return undefined;
    }
}

/**
 * Returns the resource type of a namespace-resource document `$id`, or undefined if the id is a
 * control document or is not conformant.
 */
export function resourceTypeFromDocumentId(id: string): ResourceType | undefined {
    try {
        return parseDocumentId(id).type;
    } catch {
        return undefined;
    }
}

export function constructDocumentId(metadata: DocumentMetadata): string {
    if (!metadata.namespace || !metadata.mapping) {
        throw new Error('Invalid document $id format. Document ID must be of the form $BASE_URL/calm/namespaces/$NAMESPACE/$TYPE/$MAPPING_ID/versions/$VERSION');
    }
    return `${metadata.baseUrl}/calm/namespaces/${metadata.namespace}/${metadata.type}/${metadata.mapping}/versions/${metadata.version}`;
}

/** A string field that is not blank, as CALM Hub reads it (textual and not blank). The value is not trimmed. */
function textField(json: Record<string, unknown>, key: string): string | undefined {
    const value = json[key];
    return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * The field that holds a document's display name, for a read and for a write. It is `title`,
 * except for a flow with no title: a CALM flow has `name`, and the flow schema forbids extra
 * fields, so a write must not add `title` to it. CALM Hub applies the same rule. A document
 * with no resource type is not a CALM Hub mapping resource and only has a `title`.
 */
export function documentNameField(json: Record<string, unknown>, type?: ResourceType): 'title' | 'name' {
    return type === 'flows' && textField(json, 'title') === undefined ? 'name' : 'title';
}

/** The display name of a document, or undefined if it has none. */
export function documentName(json: Record<string, unknown>, type?: ResourceType): string | undefined {
    return textField(json, documentNameField(json, type));
}

export function extractDocumentMetadata(document: string): DocumentMetadata {
    try {
        const json = JSON.parse(document);
        const documentId = json['$id'];
        if (typeof documentId !== 'string') {
            throw new Error('Document does not contain a valid \'$id\' field');
        }
        const idMetadata = parseDocumentId(documentId);
        const name = documentName(json, idMetadata.type);
        if (name === undefined) {
            throw new Error(`Missing '${documentNameField(json, idMetadata.type)}' field in parsed document.`);
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
        json[documentNameField(json, newDocumentMetadata.type)] = newDocumentMetadata.name;
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
        if (key === 'baseUrl' || key === 'rawDocumentId') continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expected = (expectedMetadata as any)[key];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actual = (actualMetadata as any)[key];
        if (expected !== actual) {
            throw new DocumentMetadataValidationError(key, expected, actual);
        }
    }
}