import { defaultC4Mapping, type C4Kind, type ResolvedC4Mapping } from './mapping.js';

/** Where the kind of an element comes from. `structure` means the projection guessed it. */
export type C4KindSource = 'mapping' | 'default' | 'structure' | 'implicit';

export type C4ExternalReason = 'outside-enterprise' | 'mapped-external' | 'other-team';

export type C4ConflictRule =
    | 'person-inside'
    | 'inside-person'
    | 'component-without-container'
    | 'inside-component'
    | 'strict-nesting'
    | 'hidden-relationship';

export interface C4Conflict {
    element: string;
    rule: C4ConflictRule;
    message: string;
}

export interface C4Element {
    id: string;
    name: string;
    description: string;
    nodeType: string;
    kind: C4Kind;
    source: C4KindSource;
    /** The nearest `composed-of` ancestor that is not an enterprise boundary, deployment node, hidden node or person. */
    parent?: string;
    external: C4ExternalReason[];
    detailedArchitecture?: string;
    /** Why the shown kind differs from the mapped kind. */
    notes: string[];
}

export interface C4Relationship {
    source: string;
    target: string;
    label: string;
    technology?: string;
    /** How many CALM relationships this one stands for after lifting. */
    count: number;
}

export interface C4Model {
    elements: Map<string, C4Element>;
    relationships: C4Relationship[];
    /** Node id → the node it is `deployed-in`. */
    deployedIn: Map<string, string>;
    hasEnterpriseBoundary: boolean;
    conflicts: C4Conflict[];
}

export interface C4ArchitectureInput {
    title?: string;
    nodes?: {
        'unique-id': string;
        'node-type': string;
        name?: string;
        description?: string;
        details?: { 'detailed-architecture'?: string };
    }[];
    relationships?: {
        'unique-id': string;
        description?: string;
        protocol?: string;
        'relationship-type': {
            connects?: { source: { node: string }; destination: { node: string } };
            interacts?: { actor: string; nodes: string[] };
            'composed-of'?: { container: string; nodes: string[] };
            'deployed-in'?: { container: string; nodes: string[] };
        };
    }[];
}

export interface C4ProjectionOptions {
    /** The CALM Hub namespace of the architecture. Rule E3 applies only when it is set. */
    namespace?: string;
    /** The name of the implicit software system when the architecture has no `title`. */
    architectureName?: string;
}

export const C4_IMPLICIT_SYSTEM_ID = '__c4-implicit-system__';

const LEVEL: Partial<Record<C4Kind, number>> = { 'software-system': 1, container: 2, component: 3 };
const KIND_AT_LEVEL: Record<number, C4Kind> = { 1: 'software-system', 2: 'container', 3: 'component' };
const NOT_A_PARENT: ReadonlySet<C4Kind> = new Set(['enterprise-boundary', 'deployment-node', 'hidden', 'person']);

/** Applies a resolved mapping and the structural and external rules of the C4 standard to an architecture. */
export function projectC4(
    architecture: C4ArchitectureInput,
    mapping: ResolvedC4Mapping = defaultC4Mapping(),
    options: C4ProjectionOptions = {}
): C4Model {
    const nodes = new Map((architecture.nodes ?? []).map((node) => [node['unique-id'], node]));
    const relationships = architecture.relationships ?? [];

    const composedParent = new Map<string, string>();
    const deployedIn = new Map<string, string>();
    for (const relationship of relationships) {
        const composed = relationship['relationship-type']['composed-of'];
        if (composed && nodes.has(composed.container)) {
            for (const child of composed.nodes) {
                if (nodes.has(child) && child !== composed.container && !composedParent.has(child)) {
                    composedParent.set(child, composed.container);
                }
            }
        }
        const deployed = relationship['relationship-type']['deployed-in'];
        if (deployed && nodes.has(deployed.container)) {
            for (const child of deployed.nodes) if (nodes.has(child)) deployedIn.set(child, deployed.container);
        }
    }

    const mapped = (id: string) => mapping['node-types'][nodes.get(id)!['node-type']];
    const ancestors = (id: string): string[] => {
        const chain: string[] = [];
        const seen = new Set([id]);
        for (let current = composedParent.get(id); current && !seen.has(current); current = composedParent.get(current)) {
            chain.push(current);
            seen.add(current);
        }
        return chain;
    };
    const isBoundary = (id: string) => mapped(id)?.kind === 'enterprise-boundary';

    const elements = new Map<string, C4Element>();
    const conflicts: C4Conflict[] = [];
    const conflict = (element: C4Element, rule: C4ConflictRule, message: string) =>
        conflicts.push({ element: element.id, rule, message });

    // A parent resolves before its children, because rules 2 and the nesting rules read its final kind.
    const resolve = (id: string): C4Element => {
        const existing = elements.get(id);
        if (existing) return existing;
        const node = nodes.get(id)!;
        const chain = ancestors(id);
        const parentIndex = chain.findIndex((ancestor) => !NOT_A_PARENT.has(mapped(ancestor)?.kind as C4Kind));
        const parentId = parentIndex < 0 ? undefined : chain[parentIndex];
        const person = (parentIndex < 0 ? chain : chain.slice(0, parentIndex)).find((ancestor) => mapped(ancestor)?.kind === 'person');
        const parent = parentId ? resolve(parentId) : undefined;
        const entry = mapped(id);
        const element: C4Element = {
            id,
            name: node.name ?? id,
            description: node.description ?? '',
            nodeType: node['node-type'],
            kind: entry?.kind ?? 'software-system',
            source: entry?.source ?? 'structure',
            parent: parentId,
            external: entry?.external ? ['mapped-external'] : [],
            detailedArchitecture: node.details?.['detailed-architecture'],
            notes: [],
        };
        elements.set(id, element);

        const parentLevel = parent ? (LEVEL[parent.kind] ?? 0) : 0;
        const inside = parent ? `${parent.kind} "${parent.name}"` : '';
        if (!entry) {
            if (parentLevel > 0) element.kind = KIND_AT_LEVEL[Math.min(parentLevel + 1, 3)];
        } else if (LEVEL[entry.kind] !== undefined && parent && LEVEL[entry.kind]! <= parentLevel) {
            if (mapping.nesting === 'strict') {
                conflict(element, 'strict-nesting', `Mapped as ${entry.kind}, but it is inside ${inside}`);
            } else if (parentLevel < 3) {
                element.kind = KIND_AT_LEVEL[parentLevel + 1];
                element.notes.push(`Mapped as ${entry.kind}, shown as ${element.kind} because it is inside ${inside}`);
            }
        }
        if (person) conflict(element, 'inside-person', `Inside the person "${nodes.get(person)!.name ?? person}"`);
        if (element.kind === 'person' && parentLevel > 0) {
            conflict(element, 'person-inside', `A person inside ${inside}`);
        }
        if (LEVEL[element.kind] !== undefined && parent?.kind === 'component') {
            conflict(element, 'inside-component', `A ${element.kind} inside ${inside}`);
        } else if (element.kind === 'component' && parent?.kind !== 'container') {
            conflict(element, 'component-without-container', 'A component with no container above it');
        }
        return element;
    };
    for (const id of nodes.keys()) resolve(id);

    // Rule 6.
    const orphans = [...elements.values()].filter((element) => !element.parent && element.kind === 'container');
    if (orphans.length > 0) {
        elements.set(C4_IMPLICIT_SYSTEM_ID, {
            id: C4_IMPLICIT_SYSTEM_ID,
            name: architecture.title ?? options.architectureName ?? 'Implicit software system',
            description: 'The containers that no software system holds',
            nodeType: '',
            kind: 'software-system',
            source: 'implicit',
            external: [],
            notes: [],
        });
        for (const orphan of orphans) orphan.parent = C4_IMPLICIT_SYSTEM_ID;
    }

    // E2.
    const hasEnterpriseBoundary = [...nodes.keys()].some(isBoundary);
    if (hasEnterpriseBoundary) {
        const insideEnterprise = (id: string) => ancestors(id).some(isBoundary);
        for (const element of elements.values()) {
            if (LEVEL[element.kind] === undefined && element.kind !== 'person') continue;
            const members = element.id === C4_IMPLICIT_SYSTEM_ID ? orphans.map((orphan) => orphan.id) : [element.id];
            if (!members.some(insideEnterprise)) element.external.push('outside-enterprise');
        }
    }

    // E3 runs after every kind is set, so the children of another team's node keep their levels.
    if (options.namespace) {
        for (const element of elements.values()) {
            const owner = element.detailedArchitecture && hubNamespaceOf(element.detailedArchitecture);
            if (!owner || isSameOrBelow(options.namespace, owner)) continue;
            element.external.push('other-team');
            if (element.kind !== 'software-system') {
                element.notes.push(`Owned by namespace ${owner}, so it is shown as a software system, not a ${element.kind}`);
                element.kind = 'software-system';
            }
        }
    }

    const merged = new Map<string, C4Relationship>();
    const add = (source: string, target: string, label: string, technology?: string) => {
        if (!nodes.has(source) || !nodes.has(target)) return;
        if (elements.get(source)!.kind === 'hidden' || elements.get(target)!.kind === 'hidden') return;
        const key = `${source}\u0000${target}`;
        const existing = merged.get(key);
        if (existing) existing.count++;
        else merged.set(key, { source, target, label, technology, count: 1 });
    };
    const isHidden = (id: string) => elements.get(id)?.kind === 'hidden';
    for (const relationship of relationships) {
        const type = relationship['relationship-type'];
        let ends: string[] = [];
        if (type.connects) ends = [type.connects.source.node, type.connects.destination.node];
        else if (type.interacts) ends = [type.interacts.actor, ...type.interacts.nodes];
        for (const id of new Set(ends.filter(isHidden))) {
            const name = type.connects ? 'connects' : 'interacts';
            conflict(elements.get(id)!, 'hidden-relationship', `Hidden, so its ${name} relationship "${relationship['unique-id']}" is not drawn`);
        }
        const label = relationship.description ?? 'Uses';
        if (type.connects) add(type.connects.source.node, type.connects.destination.node, label, relationship.protocol);
        if (type.interacts) for (const target of type.interacts.nodes) add(type.interacts.actor, target, label, relationship.protocol);
    }

    return { elements, relationships: [...merged.values()], deployedIn, hasEnterpriseBoundary, conflicts };
}

/** The namespace in a CALM Hub architecture URL (`.../calm/namespaces/{namespace}/architectures/...`). */
function hubNamespaceOf(reference: string): string | undefined {
    return /\/calm\/namespaces\/([^/]+)\/architectures\//.exec(reference)?.[1];
}

function isSameOrBelow(namespace: string, owner: string): boolean {
    return namespace === owner || namespace.startsWith(`${owner}.`);
}
