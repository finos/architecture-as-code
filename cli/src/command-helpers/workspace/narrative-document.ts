import { NarrativeDocumentRequest, NarrativeDocumentType, NARRATIVE_DOCUMENT_TYPES } from '@finos/calm-shared/src/hub/calm-hub-client';
import { parseYamlFrontMatterMapping } from '@finos/calm-shared/src/template/front-matter';

const LOCATION_PATTERN = new RegExp(
    `^/api/calm/namespaces/([^/]+)/documents/(${NARRATIVE_DOCUMENT_TYPES.join('|')})/(\\d+)/versions/` +
    `((?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*))$`
);
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
}

export function isNarrativeDocumentType(type: unknown): type is NarrativeDocumentType {
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
    };
}

export function validateNarrativeIdentity(identity: unknown, requireDocumentId: boolean, label?: string): asserts identity is NarrativeDocumentIdentity {
    const prefix = label ? `Narrative document '${label}' ` : 'Narrative document ';
    if (!identity || typeof identity !== 'object') {
        throw new Error(`${prefix}identity must be an object.`);
    }
    const candidate = identity as Record<string, unknown>;
    if (typeof candidate.namespace !== 'string' || !NAMESPACE_PATTERN.test(candidate.namespace)) {
        throw new Error(`${prefix}namespace must be a non-empty valid namespace.`);
    }
    if (!isNarrativeDocumentType(candidate.type)) {
        throw new Error(`${prefix}has unsupported type '${String(candidate.type)}'.`);
    }
    if (typeof candidate.version !== 'string' || !SEMVER_PATTERN.test(candidate.version)) {
        throw new Error(`${prefix}version '${String(candidate.version)}' must be major.minor.patch.`);
    }
    if (requireDocumentId && (!Number.isSafeInteger(candidate.calmHubDocumentId) || (candidate.calmHubDocumentId as number) <= 0)) {
        throw new Error(`${prefix}calmHubDocumentId must be a positive integer.`);
    }
}

export function parseNarrativeDocumentLocation(
    location: unknown,
    identity: NarrativeDocumentIdentity,
    requireIdentityVersion: boolean = true
): number {
    if (typeof location !== 'string' || !location) {
        throw new Error(`Narrative document Location '${String(location)}' has an unexpected format.`);
    }
    const path = extractLocationPath(location);
    const match = LOCATION_PATTERN.exec(path);
    if (!match) {
        throw new Error(`Narrative document Location '${location}' has an unexpected format.`);
    }
    const [, namespace, type, idString, version] = match;
    if (namespace !== identity.namespace || type !== identity.type || (requireIdentityVersion && version !== identity.version)) {
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

function extractLocationPath(location: string): string {
    if (location.startsWith('/')) {
        return location;
    }

    try {
        const url = new URL(location);
        if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) {
            throw new Error('invalid Location URL');
        }
        return url.pathname;
    } catch {
        throw new Error(`Narrative document Location '${location}' has an unexpected format.`);
    }
}
