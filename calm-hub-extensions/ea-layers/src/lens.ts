import { fitLensReply } from './fit.js';

// The CALM fields that this lens reads. It needs no CALM library: an architecture is plain JSON.
export interface CalmNode {
    'unique-id': string;
    'node-type': string;
    name?: string;
    description?: string;
}

export interface CalmRelationship {
    'unique-id': string;
    description?: string;
    protocol?: string;
    'relationship-type': {
        connects?: { source: { node: string }; destination: { node: string } };
        interacts?: { actor: string; nodes: string[] };
        'composed-of'?: { container: string; nodes: string[] };
        'deployed-in'?: { container: string; nodes: string[] };
    };
}

export interface CalmArchitecture {
    nodes?: CalmNode[];
    relationships?: CalmRelationship[];
}

// The lens reply of hubApi 0 (calm-hub lens.schema.json), with only the fields that this lens sends.
export interface GraphNode {
    id: string;
    label: string;
    tags: string[];
    badges?: { text: string; tone: 'warning' }[];
    group?: string;
    calm: string[];
    tooltip?: string;
}

export interface GraphGroup {
    id: string;
    label: string;
    parent?: string;
    tags: string[];
    calm?: string[];
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
    technology?: string;
    tags: string[];
    calm: string[];
}

type Block =
    | { type: 'alert'; tone: 'info' | 'warning'; text: string }
    | { type: 'table'; columns: string[]; rows: string[][] };

export interface LensReply {
    hubApi: 0;
    kind: 'graph';
    title: string;
    layout: { algorithm: 'layered'; direction: 'up' | 'right' };
    graph: { groups: GraphGroup[]; nodes: GraphNode[]; edges: GraphEdge[] };
    controls: { type: 'segmented'; param: 'view'; label: string; items: { value: View; label: string }[] }[];
    panels: { title: string; blocks: Block[] }[];
}

export const VIEWS = ['layered', 'application'] as const;
export type View = (typeof VIEWS)[number];

const VIEW_LABEL: Record<View, string> = { layered: 'Layered', application: 'Application cooperation' };

export function parseView(value: string | null): View {
    return VIEWS.find((view) => view === value) ?? 'layered';
}

type Layer = 'Business' | 'Application' | 'Technology';

interface ElementKind {
    element: string;
    layer?: Layer;
}

/** The element of the ArchiMate® notation that each CALM node type stands for. A tag of the notation has the same name. */
export const ELEMENT_OF: Readonly<Record<string, ElementKind>> = {
    actor: { element: 'Business Actor', layer: 'Business' },
    system: { element: 'Application Component', layer: 'Application' },
    service: { element: 'Application Component', layer: 'Application' },
    webclient: { element: 'Application Interface', layer: 'Application' },
    'data-asset': { element: 'Data Object', layer: 'Application' },
    database: { element: 'System Software', layer: 'Technology' },
    ldap: { element: 'Technology Service', layer: 'Technology' },
    network: { element: 'Communication Network', layer: 'Technology' },
    ecosystem: { element: 'Grouping' },
};

// A node type that the table does not name is most often a service of the team's own vocabulary.
const GUESSED: ElementKind = { element: 'Application Component', layer: 'Application' };
const LAYERS: Layer[] = ['Business', 'Application', 'Technology'];

// True when `inner` is `outer`, or is inside it: nesting `outer` in `inner` would then make a cycle.
function contains(containerOf: ReadonlyMap<string, string>, outer: string, inner: string): boolean {
    for (let id: string | undefined = inner; id !== undefined; id = containerOf.get(id)) if (id === outer) return true;
    return false;
}

const kindOf = (node: CalmNode) => (Object.hasOwn(ELEMENT_OF, node['node-type']) ? ELEMENT_OF[node['node-type']] : undefined);

/**
 * The layers lens of an architecture.
 * - `layered`: every element in its business, application or technology layer, with composition as an edge.
 * - `application`: the application layer only, with composition drawn as nesting.
 */
export function layersLensReply(architecture: CalmArchitecture, view: View): LensReply {
    const nodes = architecture.nodes ?? [];
    const relationships = architecture.relationships ?? [];
    const kinds = new Map(nodes.map((node) => [node['unique-id'], kindOf(node) ?? GUESSED]));
    const guessed = nodes.filter((node) => !kindOf(node));

    // In the application view, a container of application elements is a group around them, not a node.
    const containerOf = new Map<string, string>();
    if (view === 'application') {
        for (const relationship of relationships) {
            const composed = relationship['relationship-type']['composed-of'];
            if (!composed || kinds.get(composed.container)?.layer === 'Technology') continue;
            for (const part of composed.nodes) {
                if (kinds.get(part)?.layer !== 'Application' || containerOf.has(part) || contains(containerOf, part, composed.container)) continue;
                containerOf.set(part, composed.container);
            }
        }
    }
    const containers = new Set(containerOf.values());
    const groupId = (id: string) => `group:${id}`;

    const shown = nodes.filter((node) => view === 'layered' || (kinds.get(node['unique-id'])?.layer === 'Application' && !containers.has(node['unique-id'])));
    const layerOf = (id: string) => (view === 'layered' ? kinds.get(id)?.layer : undefined);
    const usedLayers = LAYERS.filter((layer) => shown.some((node) => layerOf(node['unique-id']) === layer));
    const byId = new Map(nodes.map((node) => [node['unique-id'], node]));

    const groups: GraphGroup[] = [
        ...usedLayers.map((layer) => ({ id: `layer:${layer}`, label: `${layer} layer`, tags: [`${layer} Layer`] })),
        ...[...containers].map((id) => ({
            id: groupId(id),
            label: byId.get(id)?.name ?? id,
            ...(containerOf.has(id) && { parent: groupId(containerOf.get(id)!) }),
            tags: [kinds.get(id)!.element],
            calm: [id],
        })),
    ];

    const graphNodes: GraphNode[] = shown.map((node) => {
        const id = node['unique-id'];
        const { element, layer } = kinds.get(id)!;
        const isGuessed = guessed.includes(node);
        const group = view === 'layered' ? (layer && `layer:${layer}`) : containerOf.has(id) ? groupId(containerOf.get(id)!) : undefined;
        const tooltip = [`${element} (CALM ${node['node-type']})`, node.description].filter(Boolean).join('. ');
        return {
            id,
            label: node.name ?? id,
            tags: [...(layer ? [layer] : []), element, ...(isGuessed ? ['Guessed'] : [])],
            ...(isGuessed && { badges: [{ text: 'Type guessed', tone: 'warning' as const }] }),
            ...(group && { group }),
            calm: [id],
            tooltip,
        };
    });

    const drawn = new Set(graphNodes.map((node) => node.id));
    const endpoint = (id: string) => (containers.has(id) ? groupId(id) : drawn.has(id) ? id : undefined);
    const edges = new Map<string, GraphEdge>();
    const add = (id: string, from: string, to: string, tag: string, relationship: CalmRelationship) => {
        const [source, target] = [endpoint(from), endpoint(to)];
        if (!source || !target || source === target || edges.has(id)) return;
        edges.set(id, {
            id, source, target, tags: [tag], calm: [relationship['unique-id']],
            ...(relationship.description && { label: relationship.description }),
            ...(relationship.protocol && { technology: relationship.protocol }),
        });
    };

    for (const relationship of relationships) {
        const type = relationship['relationship-type'];
        const id = relationship['unique-id'];
        if (type.connects) {
            const { source: { node: from }, destination: { node: to } } = type.connects;
            const isData = (node: string) => kinds.get(node)?.element === 'Data Object';
            // Access goes from the element to the data that it uses. Serving points from the provider to the element
            // that uses it, so a CALM connection turns round.
            if (isData(to) || isData(from)) add(id, isData(to) ? from : to, isData(to) ? to : from, 'Access', relationship);
            else add(id, to, from, 'Serving', relationship);
        }
        for (const node of type.interacts?.nodes ?? []) add(`${id}:${node}`, node, type.interacts!.actor, 'Serving', relationship);
        if (view === 'layered') {
            for (const part of type['composed-of']?.nodes ?? []) add(`${id}:${part}`, type['composed-of']!.container, part, 'Composition', relationship);
        }
        for (const node of type['deployed-in']?.nodes ?? []) add(`${id}:${node}`, type['deployed-in']!.container, node, 'Assignment', relationship);
    }

    const notes: Block[] = [
        { type: 'alert', tone: 'info', text: 'A serving relationship points from the provider to the element that uses it, as the ArchiMate® notation draws it. So it runs against the CALM connection.' },
    ];
    if (graphNodes.length === 0) notes.push({ type: 'alert', tone: 'info', text: 'This architecture has no application elements to show.' });
    if (guessed.length > 0) {
        const types = [...new Set(guessed.map((node) => node['node-type']))].sort().join(', ');
        notes.push({ type: 'alert', tone: 'warning', text: `${guessed.length} ${guessed.length === 1 ? 'node has a node type' : 'nodes have node types'} that the lens does not know (${types}), shown as application components.` });
    }
    const used = [...new Set(nodes.map((node) => node['node-type']))].sort().map((type) => [type, (Object.hasOwn(ELEMENT_OF, type) ? ELEMENT_OF[type] : GUESSED).element]);
    notes.push({ type: 'table', columns: ['CALM node type', 'Element'], rows: used });
    notes.push({ type: 'alert', tone: 'info', text: 'ArchiMate is a registered trademark of The Open Group in the United States and other countries.' });

    return fitLensReply({
        hubApi: 0,
        kind: 'graph',
        title: view === 'layered' ? 'Layered view' : 'Application cooperation view',
        layout: { algorithm: 'layered', direction: view === 'layered' ? 'up' : 'right' },
        graph: { groups, nodes: graphNodes, edges: [...edges.values()] },
        controls: [{ type: 'segmented', param: 'view', label: 'View', items: VIEWS.map((value) => ({ value, label: VIEW_LABEL[value] })) }],
        panels: [{ title: 'Notes', blocks: notes }],
    });
}
