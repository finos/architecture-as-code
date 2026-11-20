import {
    C4_IMPLICIT_SYSTEM_ID,
    C4_LEVELS,
    c4ChainOf,
    c4Scopes,
    c4View,
    type C4Element,
    type C4Level,
    type C4Model,
    type C4View,
} from '@finos/calm-models/c4';
import { fitLensReply } from './fit.js';

// The lens reply of hubApi 0 (calm-hub lens.schema.json), with only the fields that this lens sends.
export interface GraphNode {
    id: string;
    label: string;
    metadata?: string;
    description?: string;
    tags: string[];
    badges?: { text: string; tone: 'neutral' | 'warning' }[];
    group?: string;
    calm?: string[];
    link?: { params: Record<string, string> };
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
    tooltip?: string;
    calm?: string[];
}

type Block =
    | { type: 'alert'; tone: 'info' | 'warning' | 'negative'; text: string }
    | { type: 'table'; columns: string[]; rows: string[][] };

export interface LensReply {
    hubApi: 0;
    kind: 'graph';
    title: string;
    layout: { algorithm: 'layered'; direction: 'down' };
    graph: { groups: GraphGroup[]; nodes: GraphNode[]; edges: GraphEdge[] };
    controls: (
        | { type: 'segmented'; param: 'level'; label: string; items: { value: string; label: string }[] }
        | { type: 'select'; param: 'scope'; label: string; value: string; items: { value: string; label: string }[] }
    )[];
    panels: { title: string; blocks: Block[] }[];
}

/** Where the C4 mapping came from, for the notes. */
export interface MappingSource {
    id: string;
    namespace?: string;
    conventionId?: number;
    version?: string;
    inherited?: boolean;
}

export const LEVEL_LABEL: Record<C4Level, string> = {
    context: 'Context',
    container: 'Container',
    component: 'Component',
    deployment: 'Deployment',
};

const KIND_TAG: Record<string, string> = {
    person: 'Person',
    'software-system': 'Software System',
    container: 'Container',
    component: 'Component',
};

const NODE_TYPE_TAG: Record<string, string> = { database: 'Database', webclient: 'Web Browser' };

const EXTERNAL_LABEL: Record<string, string> = {
    'outside-enterprise': 'Outside the enterprise',
    'mapped-external': 'External type',
    'other-team': 'Another team',
};

export function parseLensLevel(value: string | null): C4Level {
    return C4_LEVELS.find((level) => level === value) ?? 'context';
}

function metadata(element: C4Element): string {
    const kind = element.source === 'implicit' ? 'Software System, implicit' : (KIND_TAG[element.kind] ?? element.kind);
    return `[${kind}${element.nodeType ? `: ${element.nodeType}` : ''}]`;
}

/** The level and scope that a click on the element opens, or undefined when it has nothing inside. */
function drillDown(element: C4Element, openable: Set<string>, view: C4View): Record<string, string> | undefined {
    if (!openable.has(element.id) || (element.id === view.scope?.id && view.level !== 'context')) return undefined;
    return { level: element.kind === 'container' ? 'component' : 'container', scope: element.id };
}

function node(element: C4Element, view: C4View, openable: Set<string>, calmIds: ReadonlySet<string>, group?: string): GraphNode {
    const tags = ['Element', KIND_TAG[element.kind] ?? element.kind];
    const nodeTypeTag = NODE_TYPE_TAG[element.nodeType];
    if (nodeTypeTag) tags.push(nodeTypeTag);
    if (element.external.length > 0) tags.push('External');
    const guessed = element.source === 'structure';
    if (guessed) tags.push('Guessed');
    const badges: GraphNode['badges'] = [
        ...element.external.map((reason) => ({ text: EXTERNAL_LABEL[reason] ?? reason, tone: 'neutral' as const })),
        ...(guessed ? [{ text: 'Guessed', tone: 'warning' as const }] : []),
    ];
    const link = drillDown(element, openable, view);
    return {
        id: element.id,
        label: element.name,
        metadata: metadata(element),
        ...(element.description && { description: element.description }),
        tags,
        ...(badges.length > 0 && { badges }),
        ...(group && { group }),
        ...(calmIds.has(element.id) && { calm: [element.id] }),
        ...(link && { link: { params: link } }),
        ...(element.notes.length > 0 && { tooltip: element.notes.join('\n') }),
    };
}

/** The groups of a view: the scope's boundary, the enterprise boundary, or the deployment nodes. */
function grouping(view: C4View, model: C4Model, calmIds: ReadonlySet<string>): { groups: GraphGroup[]; groupOf: Map<string, string> } {
    const groupOf = new Map<string, string>();
    if (view.deployments) {
        const hosts = new Set(view.deployments.map(({ node }) => node.id));
        const parentOf = new Map<string, string>();
        for (const { node, hosted } of view.deployments) {
            for (const child of hosted) if (hosts.has(child.id)) parentOf.set(child.id, node.id);
        }
        // A deployed-in cycle has no top, so each node in it is drawn at the top level.
        const inCycle = (id: string) => {
            for (let up = parentOf.get(id), steps = 0; up !== undefined && steps <= parentOf.size; up = parentOf.get(up), steps++) {
                if (up === id) return true;
            }
            return false;
        };
        const groups = view.deployments.map(({ node, hosted }) => {
            for (const element of hosted) if (!hosts.has(element.id) || inCycle(element.id)) groupOf.set(element.id, `deployment:${node.id}`);
            const parent = parentOf.get(node.id);
            return {
                id: `deployment:${node.id}`,
                label: `${node.name} [Deployment Node${node.nodeType ? `: ${node.nodeType}` : ''}]`,
                ...(parent !== undefined && !inCycle(node.id) && { parent: `deployment:${parent}` }),
                tags: ['Deployment Node'],
                ...(calmIds.has(node.id) && { calm: [node.id] }),
            };
        });
        return { groups, groupOf };
    }
    if (view.level !== 'context' && view.scope) {
        const scope = view.scope;
        const id = `boundary:${scope.id}`;
        for (const element of view.inside) groupOf.set(element.id, id);
        const kind = KIND_TAG[scope.kind] ?? scope.kind;
        return {
            groups: [{
                id, label: `${scope.name} [${kind}]`, tags: [`${kind} Boundary`],
                ...(calmIds.has(scope.id) && { calm: [scope.id] }),
            }],
            groupOf,
        };
    }
    const boundary = [...model.elements.values()].find((element) => element.kind === 'enterprise-boundary');
    const inEnterprise = (element: C4Element) => !element.external.includes('outside-enterprise') && !element.external.includes('mapped-external');
    const members = boundary ? view.outside.filter(inEnterprise) : [];
    if (!boundary || members.length === 0) return { groups: [], groupOf };
    for (const element of members) groupOf.set(element.id, `enterprise:${boundary.id}`);
    return { groups: [{ id: `enterprise:${boundary.id}`, label: boundary.name, tags: ['Enterprise Boundary'], ...(calmIds.has(boundary.id) && { calm: [boundary.id] }) }], groupOf };
}

function notes(model: C4Model, source: MappingSource, empty: string | undefined): LensReply['panels'] {
    const name = (id: string) => model.elements.get(id)?.name ?? id;
    const guessed = [...model.elements.values()].filter((element) => element.source === 'structure');
    const elementNotes = [...model.elements.values()].flatMap((element) => element.notes.map((text) => [element.name, text]));
    const from = source.conventionId === undefined
        ? 'the default mapping of the C4 standard'
        : `convention ${source.conventionId} version ${source.version} of namespace ${source.namespace}${source.inherited ? ', inherited' : ''}`;
    const blocks: Block[] = [{ type: 'alert', tone: 'info', text: `C4 mapping ${source.id}, from ${from}.` }];
    if (empty) blocks.push({ type: 'alert', tone: 'info', text: empty });
    if (guessed.length > 0) {
        blocks.push({
            type: 'alert', tone: 'warning',
            text: `${guessed.length} element${guessed.length === 1 ? '' : 's'} with a node type that the mapping does not name. The lens guessed the kind from the structure.`,
        });
    }
    if (model.conflicts.length > 0) {
        blocks.push({ type: 'table', columns: ['Element', 'Conflict'], rows: model.conflicts.map((conflict) => [name(conflict.element), conflict.message]) });
    }
    if (elementNotes.length > 0) blocks.push({ type: 'table', columns: ['Element', 'Note'], rows: elementNotes });
    return [{ title: 'C4 notes', blocks }];
}

/**
 * Builds the lens reply for one level and scope of the model. An unknown scope falls back to the first one.
 * `calmIds` are the nodes and relationships of the open architecture. A lens element names only these in `calm`, so
 * a click selects them on the CALM diagram and Hub draws their decorators on it.
 */
export function c4LensReply(
    model: C4Model,
    level: C4Level,
    requestedScope: string | null,
    source: MappingSource,
    calmIds: ReadonlySet<string> = new Set([
        ...[...model.elements.keys()].filter((id) => id !== C4_IMPLICIT_SYSTEM_ID),
        ...model.relationships.flatMap((relationship) => relationship.ids),
    ]),
): LensReply {
    const scopes = c4Scopes(model, level);
    const scope = scopes.find((element) => element.id === requestedScope) ?? scopes[0];
    const view = c4View(model, level, scope?.id);
    const openable = new Set([...c4Scopes(model, 'container'), ...c4Scopes(model, 'component')].map((element) => element.id));
    const { groups, groupOf } = grouping(view, model, calmIds);
    const elements = view.deployments
        ? [...new Map([...view.deployments.flatMap(({ hosted }) => hosted), ...view.outside].map((e) => [e.id, e])).values()]
        : [...view.inside, ...view.outside];
    const groupIds = new Set(groups.map((group) => group.id));
    const used = new Set(groupOf.values());
    const hasContent = (group: GraphGroup): boolean => used.has(group.id) || groups.some((child) => child.parent === group.id && hasContent(child));
    // A deployment node that holds others is a group, unless it is in a deployed-in cycle.
    const drawn = elements.filter((element) => groupOf.has(element.id) || !groupIds.has(`deployment:${element.id}`));
    const nodes = drawn.map((element) => node(element, view, openable, calmIds, groupOf.get(element.id)));
    const ids = new Set(nodes.map((entry) => entry.id));
    const edges = view.relationships
        .filter((relationship) => ids.has(relationship.source) && ids.has(relationship.target))
        .map((relationship) => {
            // An edge stands for each CALM relationship that it merges or lifts.
            const calm = relationship.ids.filter((id) => calmIds.has(id));
            return {
                id: `${relationship.source}->${relationship.target}`,
                source: relationship.source,
                target: relationship.target,
                ...(relationship.label && { label: relationship.label }),
                ...(relationship.technology && { technology: relationship.technology }),
                tags: ['Relationship'],
                ...(relationship.count > 1 && { tooltip: `${relationship.count} CALM relationships` }),
                ...(calm.length > 0 && { calm }),
            };
        });
    const chain = scope && level !== 'context' && level !== 'deployment' ? c4ChainOf(model, scope.id).map((id) => model.elements.get(id)!.name) : [];
    const empty = nodes.length > 0 ? undefined : level === 'deployment'
        ? 'Nothing in this architecture is deployed in a deployment node.'
        : `No ${level} diagram: nothing in this architecture is at this level.`;
    const controls: LensReply['controls'] = [
        { type: 'segmented', param: 'level', label: 'Level', items: C4_LEVELS.map((value) => ({ value, label: LEVEL_LABEL[value] })) },
    ];
    if (level !== 'deployment' && scopes.length > 1) {
        controls.push({
            type: 'select', param: 'scope', label: level === 'component' ? 'Container' : 'System', value: scope!.id,
            items: scopes.map((element) => ({ value: element.id, label: element.name })),
        });
    }
    return fitLensReply({
        hubApi: 0,
        kind: 'graph',
        title: [`${LEVEL_LABEL[level]} diagram`, ...(chain.length ? [chain.join(' › ')] : scope && level === 'context' ? [scope.name] : [])].join(': '),
        layout: { algorithm: 'layered', direction: 'down' },
        graph: { groups: groups.filter(hasContent), nodes, edges },
        controls,
        panels: notes(model, source, empty),
    });
}
