export interface DocumentMetadata {
    rawDocumentId: string; // The original document ID as provided in the input file, if any
    namespace?: string; // Optional namespace extracted from the document ID
    mapping: string; // Optional mapping name extracted from the document ID
    baseUrl: string; // Optional base URL extracted from the document ID, if needed for constructing the full document ID
    version?: string; // Optional version extracted from the document ID, if versioning is supported in the future
    // domain?: string; // Optional domain extracted from the document ID
}


export function parseDocumentId(documentId: string): DocumentMetadata {
    // [BASE URL]/calm/namespaces/{namespace}/mappings/{mapping}  - with (/versions/{version}) for version
    const namespacePattern: RegExp = new RegExp("^(.*)/calm/namespaces/([^/]+)/mappings/([^/]+)(?:/versions/([^/]+))?$");
    // TODO 
    // const domainPattern: RegExp = new RegExp("^.*/calm/domains/([^/]+)/mappings/([^/]+)/?$");

    const matches = namespacePattern.exec(documentId);
    if (matches) {
        return {
            rawDocumentId: matches[0],
            baseUrl: matches[1],
            namespace: matches[2],
            mapping: matches[3],
            version: matches[4]
        };
    }
    // TODO typed error
    throw new Error(`Invalid document ID format: ${documentId}`);
}

export function constructDocumentId(metadata: DocumentMetadata): string {
    if (!metadata.namespace || !metadata.mapping) {
        // TODO typed error
        throw new Error("Cannot construct document ID: missing namespace or mapping in metadata");
    }
    const urlWithoutVersion =  `${metadata.baseUrl}/calm/namespaces/${metadata.namespace}/mappings/${metadata.mapping}`;
    if (!metadata.version) {
        return urlWithoutVersion;
    } else {
        return `${urlWithoutVersion}/versions/${metadata.version}`;
    }
}

export function extractDocumentMetadata(document: string): DocumentMetadata {
    try {
        const json = JSON.parse(document);
        const documentId = json['$id'];
        if (typeof documentId !== 'string') {
            throw new Error("Document does not contain a valid '$id' field");
        }
        return parseDocumentId(documentId);
    } catch (error) {
        // TODO typed error
        throw new Error(`Failed to parse document metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function updateDocumentId(document: string, newDocumentMetadata: DocumentMetadata): string {
    try {
        const newDocumentId = constructDocumentId(newDocumentMetadata);
        const json = JSON.parse(document);
        json['$id'] = newDocumentId;
        return JSON.stringify(json, null, 2);
    } catch (error) {
        // TODO typed error
        throw new Error(`Failed to parse document metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
}
