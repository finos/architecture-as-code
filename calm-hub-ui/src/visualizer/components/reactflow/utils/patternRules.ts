import { findDeclarations, type SchemaObject } from './patternTransformer.js';

/**
 * What a pattern enforces on every architecture that uses it, as opposed to
 * the fixed nodes and relationships that parsePatternData draws.
 */
export interface PatternRules {
    description?: string;
    nodeStandards: string[];
    relationshipStandards: string[];
    requiredControls: string[];
}

export interface StandardLink {
    label: string;
    /** In-app route, for a Standard on this CALM Hub. */
    route?: string;
    /** External URL, for any other absolute reference. */
    href?: string;
}

// Every node and relationship must be valid CALM anyway, so a meta-schema $ref is not a rule worth listing.
const CALM_META_SCHEMA = /\/meta\/[^/#]+\.json(#|$)/;
const HUB_STANDARD_PATH = /^\/calm\/namespaces\/([^/]+)\/standards\/([^/]+)\/versions\/([^/]+)$/;

function standardRefs(pattern: SchemaObject, key: string): string[] {
    const items = findDeclarations(pattern, key, 'items')?.['items'];
    if (!items || typeof items !== 'object') return [];

    const schemas = [items, ...(Array.isArray(items['allOf']) ? items['allOf'] : [])];
    const refs = schemas
        .map((schema) => schema?.['$ref'])
        .filter((ref): ref is string => typeof ref === 'string' && !ref.startsWith('#') && !CALM_META_SCHEMA.test(ref));
    return [...new Set(refs)];
}

function requiredControls(pattern: SchemaObject): string[] {
    const required = findDeclarations(pattern, 'controls', 'required')?.['required'];
    return Array.isArray(required) ? required.filter((id): id is string => typeof id === 'string') : [];
}

export function extractPatternRules(pattern: SchemaObject | null | undefined): PatternRules {
    if (!pattern || typeof pattern !== 'object') {
        return { description: undefined, nodeStandards: [], relationshipStandards: [], requiredControls: [] };
    }
    return {
        description: typeof pattern['description'] === 'string' ? pattern['description'] : undefined,
        nodeStandards: standardRefs(pattern, 'nodes'),
        relationshipStandards: standardRefs(pattern, 'relationships'),
        requiredControls: requiredControls(pattern),
    };
}

export function hasPatternRules(rules: PatternRules): boolean {
    return rules.nodeStandards.length > 0 || rules.relationshipStandards.length > 0 || rules.requiredControls.length > 0;
}

/**
 * Matches by hostname, like resolveDetailedArchitecture, so hub-issued URLs
 * stay in-app in local dev where the UI and the backend differ only by port.
 */
export function resolveStandardRef(ref: string, hostname: string = window.location.hostname): StandardLink {
    const isAbsolute = /^https?:\/\//.test(ref);
    if (!isAbsolute && !ref.startsWith('/')) return { label: ref };

    let url: URL;
    try {
        url = new URL(ref, `https://${hostname}`);
    } catch {
        return { label: ref };
    }

    const match = url.pathname.match(HUB_STANDARD_PATH);
    if (!match) return isAbsolute ? { label: ref, href: ref } : { label: ref };

    const [, namespace, id, version] = match;
    const label = `${id} ${version}`;
    if (url.hostname === hostname) return { label, route: `/${namespace}/standards/${id}/${version}` };
    return isAbsolute ? { label, href: ref } : { label };
}
