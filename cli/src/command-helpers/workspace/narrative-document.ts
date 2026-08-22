import { NarrativeDocumentRequest, NarrativeDocumentType, NARRATIVE_DOCUMENT_TYPES } from '@finos/calm-shared/src/hub/calm-hub-client';
import { parseYamlFrontMatterMapping } from '@finos/calm-shared/src/template/front-matter';

const LOCATION_PATTERN = /^\/api\/calm\/namespaces\/([^/]+)\/documents\/(knowledge|sad)\/(\d+)\/versions\/((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/;
const NAMESPACE_PATTERN = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export interface NarrativeDocumentIdentity {
    namespace: string;
    type: NarrativeDocumentType;
    version: string;
    calmHubDocumentId?: number;
}

export interface ParsedNarrativeDocument {
    request: NarrativeDocumentRequest;
    markdown: string;
}

export function isNarrativeDocumentType(type: string): type is NarrativeDocumentType {
    return NARRATIVE_DOCUMENT_TYPES.includes(type as NarrativeDocumentType);
}

export function parseNarrativeDocument(markdown: string, label: string): ParsedNarrativeDocument {
    let frontMatter: Record<string, unknown> | null;
    try {
        frontMatter = parseYamlFrontMatterMapping(markdown);
    } catch {
        throw new Error(`Narrative document '${label}' has malformed YAML frontmatter.`);
    }
    if (!frontMatter || Object.keys(frontMatter).length === 0) {
        throw new Error(`Narrative document '${label}' must contain non-empty YAML mapping frontmatter.`);
    }

    const title = frontMatter.title;
    if (typeof title !== 'string' || !title.trim()) {
        throw new Error(`Narrative document '${label}' frontmatter must contain a non-empty string title.`);
    }

    const description = frontMatter.description;
    if (description !== undefined && typeof description !== 'string') {
        throw new Error(`Narrative document '${label}' frontmatter description must be a string.`);
    }

    return {
        request: {
            name: title.trim(),
            ...(description === undefined ? {} : { description }),
            documentMarkdown: markdown,
        },
        markdown,
    };
}

export function validateNarrativeIdentity(identity: NarrativeDocumentIdentity, requireDocumentId: boolean): void {
    if (!NAMESPACE_PATTERN.test(identity.namespace)) {
        throw new Error('Narrative document namespace must be a non-empty valid namespace.');
    }
    if (!isNarrativeDocumentType(identity.type)) {
        throw new Error(`Unsupported narrative document type '${identity.type}'.`);
    }
    if (!SEMVER_PATTERN.test(identity.version)) {
        throw new Error(`Narrative document version '${identity.version}' must be major.minor.patch.`);
    }
    if (requireDocumentId && (!Number.isSafeInteger(identity.calmHubDocumentId) || identity.calmHubDocumentId! <= 0)) {
        throw new Error('Narrative document calmHubDocumentId must be a positive integer.');
    }
}

export function parseNarrativeDocumentLocation(location: string, identity: NarrativeDocumentIdentity): number {
    const match = LOCATION_PATTERN.exec(location);
    if (!match) {
        throw new Error(`Narrative document Location '${location}' has an unexpected format.`);
    }
    const [, namespace, type, idString, version] = match;
    if (namespace !== identity.namespace || type !== identity.type || version !== identity.version) {
        throw new Error(`Narrative document Location '${location}' does not match the requested identity.`);
    }
    const id = Number(idString);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error(`Narrative document Location '${location}' has an invalid document id.`);
    }
    if (identity.calmHubDocumentId !== undefined && id !== identity.calmHubDocumentId) {
        throw new Error(`Narrative document Location '${location}' does not match the stored document id.`);
    }
    return id;
}
