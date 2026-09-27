import type { CommandOutcome, OutcomeCommand } from '../cli/outcome';
import { resolvePath } from '../lab/vfs';
import { HOME_DIR, type CalmDocLike, type HintFiles, type LessonState } from './types';

type Item = Record<string, unknown>;

const items = (value: unknown): Item[] =>
    Array.isArray(value) ? value.filter((item): item is Item => typeof item === 'object' && item !== null) : [];

export const nodes = (doc: CalmDocLike | null | undefined): Item[] => items(doc?.nodes);
export const relationships = (doc: CalmDocLike | null | undefined): Item[] => items(doc?.relationships);

export function nodeById(doc: CalmDocLike | null | undefined, id: unknown): Item | undefined {
    return typeof id === 'string' ? nodes(doc).find((node) => node['unique-id'] === id) : undefined;
}

export function nodesOfType(doc: CalmDocLike | null | undefined, type: string): Item[] {
    return nodes(doc).filter((node) => node['node-type'] === type);
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** Nodes whose `unique-id`, `node-type`, `name` and `description` are all non-empty strings. */
export function completeNodes(doc: CalmDocLike | null | undefined): Item[] {
    return nodes(doc).filter((node) =>
        isNonEmptyString(node['unique-id']) &&
        isNonEmptyString(node['node-type']) &&
        isNonEmptyString(node['name']) &&
        isNonEmptyString(node['description']));
}

const typeOf = (doc: CalmDocLike | null | undefined, id: unknown) => nodeById(doc, id)?.['node-type'];

function relationshipsOf(doc: CalmDocLike | null | undefined, kind: string): Item[] {
    return relationshipsOfKind(doc, kind).map((relationship) => (relationship['relationship-type'] as Item)[kind] as Item);
}

/** Relationships whose `relationship-type` has the given kind (e.g. `connects`, `interacts`). */
export function relationshipsOfKind(doc: CalmDocLike | null | undefined, kind: string): Item[] {
    return relationships(doc).filter((relationship) => {
        const detail = (relationship['relationship-type'] as Item | null | undefined)?.[kind];
        return typeof detail === 'object' && detail !== null;
    });
}

export function connectsBetween(doc: CalmDocLike | null | undefined, sourceType: string, destinationType: string): boolean {
    return relationshipsOf(doc, 'connects').some((connects) =>
        typeOf(doc, (connects.source as Item | undefined)?.node) === sourceType &&
        typeOf(doc, (connects.destination as Item | undefined)?.node) === destinationType);
}

/** The `connects` relationships from a node of `sourceType` to a node of `destinationType`. */
export function connectsRelationshipsBetween(doc: CalmDocLike | null | undefined, sourceType: string, destinationType: string): Item[] {
    return relationshipsOfKind(doc, 'connects').filter((relationship) => {
        const connects = (relationship['relationship-type'] as Item)['connects'] as Item;
        return typeOf(doc, (connects.source as Item | undefined)?.node) === sourceType &&
            typeOf(doc, (connects.destination as Item | undefined)?.node) === destinationType;
    });
}

/** A `connects` from the node with id `sourceId` to the node with id `destinationId`; both nodes must exist. */
export function connectsNodes(doc: CalmDocLike | null | undefined, sourceId: string, destinationId: string): boolean {
    if (!nodeById(doc, sourceId) || !nodeById(doc, destinationId)) {
        return false;
    }
    return relationshipsOf(doc, 'connects').some((connects) =>
        (connects.source as Item | undefined)?.node === sourceId &&
        (connects.destination as Item | undefined)?.node === destinationId);
}

export function interactsWith(doc: CalmDocLike | null | undefined, actorType: string, nodeType: string): boolean {
    return relationshipsOf(doc, 'interacts').some((interacts) =>
        typeOf(doc, interacts.actor) === actorType &&
        Array.isArray(interacts.nodes) && interacts.nodes.some((id) => typeOf(doc, id) === nodeType));
}

export function composedOf(doc: CalmDocLike | null | undefined, containerType: string, memberTypes: string[]): boolean {
    return relationshipsOf(doc, 'composed-of').some((composed) => {
        if (typeOf(doc, composed.container) !== containerType || !Array.isArray(composed.nodes)) {
            return false;
        }
        const types = composed.nodes.map((id) => typeOf(doc, id));
        return memberTypes.every((type) => types.includes(type));
    });
}

/** A node's `interfaces` array items that have a non-empty string `unique-id`. */
export function nodeInterfaces(node: Item | null | undefined): Item[] {
    return items(node?.['interfaces']).filter((iface) => isNonEmptyString(iface['unique-id']));
}

function referencesAnInterfaceOf(node: Item | undefined, ids: unknown): boolean {
    if (!Array.isArray(ids) || ids.length === 0) {
        return false;
    }
    const available = new Set(nodeInterfaces(node).map((iface) => iface['unique-id']));
    return ids.some((id) => typeof id === 'string' && available.has(id));
}

/**
 * A `connects` from a node of `sourceType` to one of `destinationType` whose `source.interfaces`
 * and `destination.interfaces` each name at least one id that exists on that node's `interfaces`.
 */
export function connectsUsesInterfaces(doc: CalmDocLike | null | undefined, sourceType: string, destinationType: string): boolean {
    return relationshipsOf(doc, 'connects').some((connects) => {
        const source = connects.source as Item | undefined;
        const destination = connects.destination as Item | undefined;
        const sourceNode = nodeById(doc, source?.node);
        const destinationNode = nodeById(doc, destination?.node);
        if (sourceNode?.['node-type'] !== sourceType || destinationNode?.['node-type'] !== destinationType) {
            return false;
        }
        return referencesAnInterfaceOf(sourceNode, source?.interfaces) && referencesAnInterfaceOf(destinationNode, destination?.interfaces);
    });
}

const isNonEmptyObject = (value: unknown): value is Item =>
    typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0;

/** `metadata` on a document, node or relationship: a non-empty object, or a non-empty array of non-empty objects. */
export function hasMetadata(item: Item | null | undefined): boolean {
    const value = item?.['metadata'];
    return Array.isArray(value) ? value.length > 0 && value.every(isNonEmptyObject) : isNonEmptyObject(value);
}

function isConfiguredRequirement(value: unknown): boolean {
    if (!isNonEmptyObject(value)) {
        return false;
    }
    return isNonEmptyString(value['requirement-url']) && (isNonEmptyObject(value['config']) || isNonEmptyString(value['config-url']));
}

/**
 * The `[domain, control]` entries of `item.controls` whose `requirements` is a non-empty array,
 * with each requirement having a string `requirement-url` and either a `config` object or a
 * `config-url` string.
 */
export function controlsIn(item: Item | null | undefined): Array<[string, Item]> {
    const controls = item?.['controls'];
    if (!isNonEmptyObject(controls)) {
        return [];
    }
    return (Object.entries(controls) as Array<[string, Item]>).filter(([, control]) => {
        if (!isNonEmptyObject(control)) {
            return false;
        }
        const requirements = control['requirements'];
        return Array.isArray(requirements) && requirements.length > 0 && requirements.every(isConfiguredRequirement);
    });
}

/**
 * `flows` entries with a string `unique-id` and `name`, whose `transitions` has at least
 * `minTransitions` items, each with a `relationship-unique-id` that matches an existing
 * relationship and a numeric `sequence-number`.
 */
export function flowsWithTransitions(doc: CalmDocLike | null | undefined, minTransitions: number): Item[] {
    const relationshipIds = new Set(relationships(doc).map((relationship) => relationship['unique-id']));
    return items(doc?.['flows']).filter((flow) => {
        if (!isNonEmptyString(flow['unique-id']) || !isNonEmptyString(flow['name'])) {
            return false;
        }
        const transitions = items(flow['transitions']);
        if (transitions.length < minTransitions) {
            return false;
        }
        return transitions.every((transition) =>
            isNonEmptyString(transition['relationship-unique-id']) &&
            relationshipIds.has(transition['relationship-unique-id']) &&
            typeof transition['sequence-number'] === 'number');
    });
}

const patternArray = (json: CalmDocLike | null | undefined, key: 'nodes' | 'relationships'): Item | undefined => {
    const properties = json?.['properties'];
    const array = isNonEmptyObject(properties) ? properties[key] : undefined;
    return isNonEmptyObject(array) ? array : undefined;
};

function exactCount(array: Item | undefined): number {
    const prefixItems = array?.['prefixItems'];
    if (!Array.isArray(prefixItems)) {
        return 0;
    }
    return array!['minItems'] === prefixItems.length && array!['maxItems'] === prefixItems.length ? prefixItems.length : 0;
}

/**
 * How many nodes and relationships a pattern requires: the `prefixItems` length of
 * `properties.nodes` and `properties.relationships`, when `minItems` and `maxItems` both equal it.
 * 0 when the count is absent or not exact.
 */
export function patternRequires(json: CalmDocLike | null | undefined): { nodes: number; relationships: number } {
    return { nodes: exactCount(patternArray(json, 'nodes')), relationships: exactCount(patternArray(json, 'relationships')) };
}

/** The non-empty `const` `unique-id` of each item in a pattern's `properties.nodes.prefixItems`. */
export function patternNodeIds(json: CalmDocLike | null | undefined): string[] {
    return items(patternArray(json, 'nodes')?.['prefixItems'])
        .map((item) => {
            const properties = item['properties'];
            const uniqueId = isNonEmptyObject(properties) ? properties['unique-id'] : undefined;
            return isNonEmptyObject(uniqueId) ? uniqueId['const'] : undefined;
        })
        .filter(isNonEmptyString);
}

function prefixItemConsts(json: CalmDocLike | null | undefined, array: 'nodes' | 'relationships', property: string): unknown[] {
    return items(patternArray(json, array)?.['prefixItems']).map((item) => {
        const properties = item['properties'];
        const value = isNonEmptyObject(properties) ? properties[property] : undefined;
        return isNonEmptyObject(value) ? value['const'] : undefined;
    });
}

/** Each item in a pattern's `properties.<array>.prefixItems` as the values its properties fix with `const`. */
export function patternItemConsts(json: CalmDocLike | null | undefined, array: 'nodes' | 'relationships'): CalmDocLike[] {
    return items(patternArray(json, array)?.['prefixItems']).map((item) => {
        const properties = item['properties'];
        return Object.fromEntries(Object.entries(isNonEmptyObject(properties) ? properties : {})
            .filter(([, value]) => isNonEmptyObject(value) && 'const' in value)
            .map(([key, value]) => [key, (value as Item)['const']]));
    });
}

/** The `const` `node-type` of each item in a pattern's `properties.nodes.prefixItems` (`undefined` where it has none). */
export function patternNodeTypes(json: CalmDocLike | null | undefined): unknown[] {
    return prefixItemConsts(json, 'nodes', 'node-type');
}

/**
 * The `connects` each item in a pattern's `properties.relationships.prefixItems` fixes with `const`
 * values, when the item also has a `const` `unique-id`; `undefined` for any other item.
 */
export function patternConnects(json: CalmDocLike | null | undefined): ({ source: string; destination: string } | undefined)[] {
    const ids = prefixItemConsts(json, 'relationships', 'unique-id');
    return prefixItemConsts(json, 'relationships', 'relationship-type').map((type, index) => {
        const connects = isNonEmptyObject(type) ? type['connects'] : undefined;
        if (!isNonEmptyString(ids[index]) || !isNonEmptyObject(connects)) {
            return undefined;
        }
        const source = (connects['source'] as Item | undefined)?.['node'];
        const destination = (connects['destination'] as Item | undefined)?.['node'];
        return isNonEmptyString(source) && isNonEmptyString(destination) ? { source, destination } : undefined;
    });
}

const CORE_DEF_REF: Record<'node' | 'relationship', string> = {
    node: 'https://calm.finos.org/release/1.2/meta/core.json#/defs/node',
    relationship: 'https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship',
};

/**
 * The `required` property names a Standard adds on top of a CALM core definition: the union of
 * every `allOf` entry's `required` array, plus the document's own top-level `required` array
 * (both are valid JSON Schema and have the same effect), when at least one `allOf` entry `$ref`s
 * the core definition named by `coreDef` (`'node'` or `'relationship'`). `[]` when no entry has
 * that `$ref`, or the document is not shaped like a Standard.
 */
export function standardRequires(json: CalmDocLike | null | undefined, coreDef: 'node' | 'relationship'): string[] {
    const allOf = items(json?.['allOf']);
    if (!allOf.some((entry) => entry['$ref'] === CORE_DEF_REF[coreDef])) {
        return [];
    }
    const required = new Set<string>();
    for (const entry of [...allOf, json]) {
        const list = entry?.['required'];
        if (Array.isArray(list)) {
            for (const name of list) {
                if (isNonEmptyString(name)) {
                    required.add(name);
                }
            }
        }
    }
    return [...required];
}

/** Every string `$ref` anywhere in a pattern or schema, once each, in document order. */
export function patternRefs(json: unknown): string[] {
    const refs = new Set<string>();
    const walk = (value: unknown) => {
        if (Array.isArray(value)) {
            value.forEach(walk);
        } else if (typeof value === 'object' && value !== null) {
            for (const [key, child] of Object.entries(value)) {
                if (key === '$ref' && isNonEmptyString(child)) {
                    refs.add(child);
                } else {
                    walk(child);
                }
            }
        }
    };
    walk(json);
    return [...refs];
}

/** Every string `$ref` under a pattern's `properties.nodes` or `properties.relationships` schema. */
export const patternArrayRefs = (json: CalmDocLike | null | undefined, key: 'nodes' | 'relationships'): string[] =>
    patternRefs(patternArray(json, key));

/** A non-empty string `description` on a document, node or relationship. */
export const hasDescription = (item: Item | null | undefined): boolean => isNonEmptyString(item?.['description']);

// The rule `architecture-has-no-placeholder-properties-string` warns on.
const PLACEHOLDER = /^\[\[\s*[A-Z_]+\s*\]\]$/;

/** A `[[ PLACEHOLDER ]]` string anywhere in `value`, as `calm generate` writes. */
export function hasPlaceholder(value: unknown): boolean {
    if (typeof value === 'string') {
        return PLACEHOLDER.test(value);
    }
    if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(hasPlaceholder);
    }
    return false;
}

/** A saved workspace file's text (absolute path), or null when it does not exist. */
export function fileText(state: HintFiles, path: string): string | null {
    return Object.prototype.hasOwnProperty.call(state.files, path) ? state.files[path] : null;
}

/** A saved workspace file parsed as a JSON object; null when it is missing, not JSON, or not an object. */
export function fileJson(state: HintFiles, path: string): CalmDocLike | null {
    const text = fileText(state, path);
    if (text === null) {
        return null;
    }
    try {
        const value: unknown = JSON.parse(text);
        return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as CalmDocLike : null;
    } catch {
        return null;
    }
}

export interface UrlMappingEntry { url: string; path: string; exists: boolean }

/**
 * The entries of a `-u` URL mapping file: each URL with its local path resolved against the
 * mapping file's folder, as the CLI and the lab resolve it. A value that is not a non-empty string
 * gives `path: ''` and `exists: false`. `[]` when the mapping is missing or not a JSON object.
 */
export function urlMappingEntries(state: LessonState, mappingPath: string): UrlMappingEntry[] {
    const directory = mappingPath.slice(0, mappingPath.lastIndexOf('/')) || '/';
    return Object.entries(fileJson(state, mappingPath) ?? {}).map(([url, value]) => {
        if (!isNonEmptyString(value)) {
            return { url, path: '', exists: false };
        }
        const path = resolvePath(directory, value);
        return { url, path, exists: fileText(state, path) !== null };
    });
}

/** The mapping's URLs whose local file exists: URL → absolute path. */
export function urlMappingTargets(state: LessonState, mappingPath: string): Record<string, string> {
    return Object.fromEntries(urlMappingEntries(state, mappingPath).filter((entry) => entry.exists).map((entry) => [entry.url, entry.path]));
}

const MARKDOWN_HEADING = /^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const MARKDOWN_FENCE = /^\s{0,3}(```|~~~)/;

/**
 * The trimmed body under the `## heading` line (case-insensitive), up to the next `#` or `##`
 * heading or the end. Deeper headings (`###`) and fenced code stay in the body. '' when there is no
 * such heading.
 */
export function markdownSection(text: string | null, heading: string): string {
    if (!text) {
        return '';
    }
    const wanted = heading.trim().toLowerCase();
    const body: string[] = [];
    let inside = false;
    let fence: string | null = null;
    for (const line of text.split(/\r?\n/)) {
        const marker = MARKDOWN_FENCE.exec(line)?.[1];
        if (marker && (fence === null || marker === fence)) {
            fence = fence === null ? marker : null;
        }
        const match = marker || fence !== null ? null : MARKDOWN_HEADING.exec(line);
        if (match && match[1].length <= 2) {
            if (inside) {
                break;
            }
            inside = match[1].length === 2 && match[2].toLowerCase() === wanted;
            continue;
        }
        if (inside) {
            body.push(line);
        }
    }
    return body.join('\n').trim();
}

const ADR_HEADINGS = ['Status', 'Context', 'Decision', 'Consequences'];

/**
 * An ADR file: `## Status`, `## Context`, `## Decision` and `## Consequences` each have a
 * non-empty body with no line left that starts with the seeded `TODO:` placeholder.
 */
export function filledAdr(text: string | null): boolean {
    return ADR_HEADINGS.every((heading) => {
        const body = markdownSection(text, heading);
        return body.length > 0 && !/^TODO:/m.test(body);
    });
}

/**
 * `doc.adrs` entries that are strings and resolve, relative to the workspace, to a saved file
 * that exists. Entries naming an external URL (or anything else that is not a workspace file)
 * are dropped, not rejected: a learner may also link an ADR tool or wiki page. Deduplicated.
 */
export function linkedAdrs(state: LessonState): string[] {
    const entries = Array.isArray(state.doc?.['adrs']) ? (state.doc!['adrs'] as unknown[]) : [];
    const resolved = entries
        .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
        .map((entry) => (entry.startsWith('/') ? entry : `${HOME_DIR}/${entry.replace(/^\.\//, '')}`));
    return [...new Set(resolved)].filter((path) => fileText(state, path) !== null);
}

export function freshOutcomes(outcomes: CommandOutcome[], read: (path: string) => string | null): CommandOutcome[] {
    return outcomes.filter((outcome) => Object.entries(outcome.snapshot).every(([path, content]) => read(path) === content));
}

function matching(state: LessonState, command: OutcomeCommand, files: Record<string, string> = {}): CommandOutcome[] {
    return state.commands.filter((outcome) =>
        outcome.command === command && Object.entries(files).every(([key, path]) => outcome.files[key] === path));
}

export const ranOk = (state: LessonState, command: OutcomeCommand, files?: Record<string, string>) =>
    matching(state, command, files).some((outcome) => outcome.ok);

/** Any failed run, whatever the cause. For a "see it fail" validate step, use `rejected`. */
export const ranFailed = (state: LessonState, command: OutcomeCommand, files?: Record<string, string>) =>
    matching(state, command, files).some((outcome) => !outcome.ok);

/**
 * A validate that failed because of the architecture alone: every error is in the architecture,
 * and no pattern error or `$ref` load failure (a missing mapped file, a broken pattern) caused it.
 */
export function isRejection(outcome: CommandOutcome): boolean {
    const architectureErrors = outcome.errorsIn?.architecture ?? 0;
    return outcome.command === 'validate' && !outcome.ok && architectureErrors > 0
        && architectureErrors === outcome.errorCount && outcome.loadFailures === 0;
}

/** A fresh validate of `files` that the engine rejected for the architecture's own errors. */
export const rejected = (state: LessonState, files?: Record<string, string>) =>
    matching(state, 'validate', files).some(isRejection);

export const validatedEditorFile = (state: LessonState) => ranOk(state, 'validate', { architecture: state.editorFile });
