import { isControlDocumentId, resourceTypeFromDocumentId, type ResourceType } from '@finos/calm-shared';
import type { CalmDocumentType } from '@finos/calm-models/types';

/** A standard is a JSON Schema that extends CALM, so the workspace tracks it as a `schema`. */
const DOCUMENT_TYPE_BY_RESOURCE_TYPE: Record<ResourceType, CalmDocumentType> = {
    patterns: 'pattern',
    architectures: 'architecture',
    flows: 'flow',
    standards: 'schema',
    interfaces: 'interface',
};

/** The CalmHub resource type for a workspace document type, or undefined if it has none. */
export function resourceTypeForDocumentType(type: CalmDocumentType): ResourceType | undefined {
    return (Object.keys(DOCUMENT_TYPE_BY_RESOURCE_TYPE) as ResourceType[])
        .find((resourceType) => DOCUMENT_TYPE_BY_RESOURCE_TYPE[resourceType] === type);
}

/** The workspace document type that a conformant CalmHub `$id` implies, or undefined for any other id. */
export function documentTypeForDocumentId(id: string): CalmDocumentType | undefined {
    const resourceType = resourceTypeFromDocumentId(id);
    if (resourceType) {
        return DOCUMENT_TYPE_BY_RESOURCE_TYPE[resourceType];
    }
    return isControlDocumentId(id) ? 'control' : undefined;
}

/**
 * Whether a conformant CalmHub `$id` can imply this document type. `timeline` and `adr` have no
 * CalmHub `$id` form of their own.
 */
export function documentTypeHasIdType(type: CalmDocumentType): boolean {
    return type === 'control' || resourceTypeForDocumentType(type) !== undefined;
}

/** The workspace document type implied by the `$id` in a JSON document's content, if any. */
export function documentTypeForContent(content: string): CalmDocumentType | undefined {
    try {
        const id = JSON.parse(content)?.['$id'];
        return typeof id === 'string' ? documentTypeForDocumentId(id) : undefined;
    } catch {
        return undefined;
    }
}
