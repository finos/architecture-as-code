// The C4 mapping standard is finos/calm-schema#53 (`standards/c4/1.0`). Load the default from
// @finos/calm-schema instead of this copy once a release ships it.

export const C4_KINDS = [
    'person',
    'software-system',
    'container',
    'component',
    'deployment-node',
    'enterprise-boundary',
    'hidden',
] as const;

export type C4Kind = (typeof C4_KINDS)[number];

export type C4MappingEntry = C4Kind | { kind: C4Kind; external?: boolean };

export type C4Nesting = 'demote' | 'strict';

export interface C4MappingDocument {
    $schema?: string;
    $id?: string;
    'unique-id': string;
    description?: string;
    extends?: string;
    'node-types'?: Record<string, C4MappingEntry>;
    nesting?: C4Nesting;
}

export interface ResolvedC4Type {
    kind: C4Kind;
    external: boolean;
    /** `default` when the entry comes from the default mapping, through `extends`. */
    source: 'mapping' | 'default';
}

export interface ResolvedC4Mapping {
    'unique-id': string;
    'node-types': Record<string, ResolvedC4Type>;
    nesting: C4Nesting;
}

export const CALM_DEFAULT_C4_MAPPING_URL = 'https://calm.finos.org/standards/c4/1.0/calm-default.c4-mapping.json';

export const CALM_DEFAULT_C4_MAPPING: C4MappingDocument = {
    $schema: 'https://calm.finos.org/standards/c4/1.0/c4-mapping.json',
    $id: CALM_DEFAULT_C4_MAPPING_URL,
    'unique-id': 'calm-default-c4-mapping',
    description: 'The default C4 mapping for the CALM node types. A tool uses it when no other mapping is set.',
    'node-types': {
        actor: 'person',
        system: 'software-system',
        service: 'container',
        database: 'container',
        webclient: 'container',
        'data-asset': 'container',
        ldap: 'container',
        ecosystem: 'enterprise-boundary',
        network: 'deployment-node',
    },
    nesting: 'demote',
};

/** Fetches the mapping at an `extends` URL. The default mapping URL never reaches the loader. */
export type C4MappingLoader = (url: string) => Promise<unknown>;

/**
 * Resolves a mapping and the chain it `extends`. With no mapping, the result is the default mapping.
 * A mapping with no `extends` replaces the default mapping.
 */
export async function resolveC4Mapping(mapping?: unknown, load?: C4MappingLoader): Promise<ResolvedC4Mapping> {
    if (mapping === undefined) return defaultC4Mapping();
    const chain = [checkC4Mapping(mapping, 'The C4 mapping')];
    const seen = new Set<string>();
    for (let parent = chain[0].extends; parent; parent = chain[chain.length - 1].extends) {
        if (seen.has(parent)) throw new Error(`The C4 mapping ${parent} extends itself through its chain`);
        seen.add(parent);
        if (parent === CALM_DEFAULT_C4_MAPPING_URL) {
            chain.push(CALM_DEFAULT_C4_MAPPING);
            break;
        }
        const cannotLoad = `Cannot load ${parent}, which the C4 mapping ${chain[chain.length - 1]['unique-id']} extends`;
        if (!load) throw new Error(cannotLoad);
        // The standard forbids using the default mapping in place of a mapping that does not load.
        let loaded: unknown;
        try {
            loaded = await load(parent);
        } catch (error) {
            throw new Error(`${cannotLoad}: ${error instanceof Error ? error.message : String(error)}`);
        }
        chain.push(checkC4Mapping(loaded, parent));
    }
    return mergeC4Mappings(chain);
}

export function defaultC4Mapping(): ResolvedC4Mapping {
    return mergeC4Mappings([CALM_DEFAULT_C4_MAPPING]);
}

/** `chain` starts with the mapping in use and ends with the mapping that extends nothing. */
function mergeC4Mappings(chain: C4MappingDocument[]): ResolvedC4Mapping {
    const nodeTypes: Record<string, ResolvedC4Type> = {};
    let nesting: C4Nesting = 'demote';
    for (const document of [...chain].reverse()) {
        const source = document === CALM_DEFAULT_C4_MAPPING ? 'default' : 'mapping';
        for (const [nodeType, entry] of Object.entries(document['node-types'] ?? {})) {
            nodeTypes[nodeType] = typeof entry === 'string'
                ? { kind: entry, external: false, source }
                : { kind: entry.kind, external: entry.external === true, source };
        }
        nesting = document.nesting ?? nesting;
    }
    return { 'unique-id': chain[0]['unique-id'], 'node-types': nodeTypes, nesting };
}

const EXTERNAL_KINDS: ReadonlySet<C4Kind> = new Set(['person', 'software-system', 'container', 'component']);

const DOCUMENT_FIELDS = new Set(['$schema', '$id', 'unique-id', 'description', 'extends', 'node-types', 'nesting']);

/** Checks a value against the rules of `c4-mapping.json`. */
export function checkC4Mapping(value: unknown, label = 'The C4 mapping'): C4MappingDocument {
    const fail = (problem: string): never => {
        throw new Error(`${label} is not a valid C4 mapping: ${problem}`);
    };
    if (!isObject(value)) return fail('it is not a JSON object');
    for (const field of Object.keys(value)) {
        if (!DOCUMENT_FIELDS.has(field)) fail(`"${field}" is not a mapping field`);
    }
    if (typeof value['unique-id'] !== 'string' || value['unique-id'] === '') fail('"unique-id" must be a non-empty string');
    for (const field of ['$schema', '$id', 'extends']) {
        if (value[field] !== undefined && !isAbsoluteUri(value[field])) fail(`"${field}" must be an absolute URI`);
    }
    if (value.description !== undefined && typeof value.description !== 'string') fail('"description" must be a string');
    if (value.nesting !== undefined && value.nesting !== 'demote' && value.nesting !== 'strict') {
        fail('"nesting" must be "demote" or "strict"');
    }
    const nodeTypes = value['node-types'];
    if (nodeTypes !== undefined) {
        if (!isObject(nodeTypes)) return fail('"node-types" must be an object');
        for (const [nodeType, entry] of Object.entries(nodeTypes)) {
            if (nodeType === '') fail('a node type must not be empty');
            if (isObject(entry)) {
                const extra = Object.keys(entry).find((field) => field !== 'kind' && field !== 'external');
                if (extra) fail(`"${extra}" of "${nodeType}" is not an entry field`);
                if (entry.external !== undefined && typeof entry.external !== 'boolean') {
                    fail(`"external" of "${nodeType}" must be true or false`);
                }
            }
            const kind = isObject(entry) ? entry.kind : entry;
            if (!C4_KINDS.includes(kind as C4Kind)) fail(`"${nodeType}" must map to one of ${C4_KINDS.join(', ')}`);
            if (isObject(entry) && entry.external === true && !EXTERNAL_KINDS.has(kind as C4Kind)) {
                fail(`"${nodeType}" can be external only with the kinds ${[...EXTERNAL_KINDS].join(', ')}`);
            }
        }
    }
    return value as unknown as C4MappingDocument;
}

function isAbsoluteUri(value: unknown): boolean {
    return typeof value === 'string' && /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
