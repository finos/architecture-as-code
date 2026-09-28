import type { CommandOutcome, OutcomeCommand } from '../cli/outcome';
import type { CalmDocLike, LessonState } from './types';

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

export function freshOutcomes(outcomes: CommandOutcome[], read: (path: string) => string | null): CommandOutcome[] {
    return outcomes.filter((outcome) => Object.entries(outcome.snapshot).every(([path, content]) => read(path) === content));
}

function matching(state: LessonState, command: OutcomeCommand, files: Record<string, string> = {}): CommandOutcome[] {
    return state.commands.filter((outcome) =>
        outcome.command === command && Object.entries(files).every(([key, path]) => outcome.files[key] === path));
}

export const ranOk = (state: LessonState, command: OutcomeCommand, files?: Record<string, string>) =>
    matching(state, command, files).some((outcome) => outcome.ok);

export const ranFailed = (state: LessonState, command: OutcomeCommand, files?: Record<string, string>) =>
    matching(state, command, files).some((outcome) => !outcome.ok);

export const validatedEditorFile = (state: LessonState) => ranOk(state, 'validate', { architecture: state.editorFile });
