import { isValidResourceType, ResourceType } from "./calm-hub-client";

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

function parseDocumentId(documentId: string): DocumentIdMetadata {
    // [BASE URL]/calm/namespaces/{namespace}/mappings/{mapping}  - with (/versions/{version}) for version
    const namespacePattern: RegExp = new RegExp('^(.*)/calm/namespaces/([^/]+)/([^/]+)/([^/]+)/versions/([^/]+)$');
    // TODO
    // const domainPattern: RegExp = new RegExp("^.*/calm/domains/([^/]+)/mappings/([^/]+)/?$");

    const matches = namespacePattern.exec(documentId);
    if (matches) {
        if (!isValidResourceType(matches[3])) {
            throw new Error("Invalid resource type: " + matches[3]);
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
    // TODO typed error
    throw new Error(`Invalid document ID format: ${documentId}`);
}

export function constructDocumentId(metadata: DocumentMetadata): string {
    if (!metadata.namespace || !metadata.mapping) {
        // TODO typed error
        throw new Error('Cannot construct document ID: missing namespace or mapping in metadata');
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
        }
    } catch (error) {
        // TODO typed error
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
        // TODO typed error
        throw new Error(`Failed to parse document metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// export function (document: string): void {
//     try {
//         const metadata = extractDocumentMetadata(document);
//         if (!metadata.namespace || !metadata.mapping) {
//             throw new Error('Document metadata is missing required namespace or mapping information');
//         }
//     } catch (error) {
//         // TODO typed error
//         throw new Error(`Document metadata validation failed: ${error instanceof Error ? error.message : String(error)}`);
//     }
// }