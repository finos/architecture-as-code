import { CalmNodeCanonicalModel } from '@finos/calm-models/canonical';
import { VMContainer, VMLeafNode, VMAttach } from '../../types';
import { labelFor } from '../utils';
import { VMFactoryProvider } from '../factories/factory-provider';

export interface ContainerForest {
    containers: VMContainer[];
    attachments: VMAttach[];
    looseNodes: VMLeafNode[];
    /** Rendered ids of each node or interface. More than one when the node is drawn in several containers. */
    instancesOf: Map<string, string[]>;
    /** Rendered container ids enclosing each rendered id, outermost first. */
    ancestorsOf: Map<string, string[]>;
}

/**
 * Recursively removes containers that have no nodes or child containers.
 * This prevents empty subgraph blocks from appearing in the rendered output,
 * which would create visual clutter and invalid Mermaid syntax.
 */
export function pruneEmptyContainers(containers: VMContainer[]): VMContainer[] {
    return containers
        .map(c => ({
            ...c,
            containers: pruneEmptyContainers(c.containers),
        }))
        .filter(c => c.nodes.length > 0 || c.containers.length > 0);
}

function append<T>(map: Map<string, T[]>, key: string, ...values: T[]): void {
    const list = map.get(key) ?? [];
    list.push(...values);
    map.set(key, list);
}

/** Copies above which a node in several containers is drawn in its first container only. */
const MAX_COPIES = 1000;

/** Number of times each id is drawn: one per drawing of each parent. */
function drawingCounter(parentsOf: (id: string) => string[]): (id: string) => number {
    const counts = new Map<string, number>();
    const count = (id: string, path: Set<string>): number => {
        const known = counts.get(id);
        if (known !== undefined) return known;
        const parents = parentsOf(id).filter(p => !path.has(p));
        const result = parents.length === 0 ? 1 : parents.reduce((sum, p) => sum + count(p, new Set(path).add(id)), 0);
        counts.set(id, result);
        return result;
    };
    return id => count(id, new Set());
}

/**
 * Builds the container forest structure for the view model. Creates VM containers
 * for each container ID, places nodes into their appropriate containers based on
 * the parent map, and handles interface rendering if enabled. Returns the root
 * containers, interface attachments, and any loose nodes that don't belong to containers.
 *
 * A node with several rendered parents is drawn once in each, together with everything
 * nested in it. Each copy gets a distinct id, `<id>__in__<parent>`, and keeps the original
 * unique-id in `sourceId` for links.
 */
export function buildContainerForest(
    nodes: CalmNodeCanonicalModel[],
    parentsOf: Map<string, string[]>,
    containerIdsToRender: Set<string>,
    renderInterfaces: boolean,
    activeInterfaceIds?: Set<string>
): ContainerForest {
    const byId = new Map(nodes.map(n => [n['unique-id'], n] as const));
    const attachmentsOf = new Map<string, VMAttach[]>();
    const looseNodes: VMLeafNode[] = [];
    const instancesOf = new Map<string, string[]>();
    const ancestorsOf = new Map<string, string[]>();
    const nodeFactory = VMFactoryProvider.getNodeFactory();

    // A copy id must not reuse the id of a real node or of another copy
    const takenIds = new Set(nodes.map(n => n['unique-id']));
    const copyId = (id: string, parentInstanceId: string) => {
        const base = `${id}__in__${parentInstanceId}`;
        let candidate = base;
        for (let i = 2; takenIds.has(candidate); i++) candidate = `${base}_${i}`;
        takenIds.add(candidate);
        return candidate;
    };

    const allRenderedParents = (id: string) =>
        (parentsOf.get(id) ?? []).filter(p => p !== id && containerIdsToRender.has(p));
    // Copies multiply with each level of shared containers. Past the limit, draw each node in its first container only.
    const ids = new Set([...containerIdsToRender, ...nodes.map(n => n['unique-id'])]);
    const allDrawings = drawingCounter(allRenderedParents);
    const capped = [...ids].reduce((sum, id) => sum + allDrawings(id) - 1, 0) > MAX_COPIES;
    const renderedParents = capped ? (id: string) => allRenderedParents(id).slice(0, 1) : allRenderedParents;
    const drawings = capped ? drawingCounter(renderedParents) : allDrawings;

    const childrenOf = new Map<string, string[]>();
    // Relationship order, as before, so sibling containers with the same label keep their order
    for (const cid of parentsOf.keys()) {
        if (!containerIdsToRender.has(cid)) continue;
        for (const p of renderedParents(cid)) append(childrenOf, p, cid);
    }
    for (const n of nodes) {
        const nid = n['unique-id'];
        if (containerIdsToRender.has(nid)) continue;
        for (const p of renderedParents(nid)) append(childrenOf, p, nid);
    }

    const record = (id: string, rendered: string, ancestors: string[]) => {
        append(instancesOf, id, rendered);
        ancestorsOf.set(rendered, ancestors);
    };

    const createLeaf = (n: CalmNodeCanonicalModel, rendered: string, ancestors: string[]): VMLeafNode => {
        const nid = n['unique-id'];
        const { node: leaf, attachments: nodeAttachments } = nodeFactory.createLeafNode(n, renderInterfaces, activeInterfaceIds);
        const rename = (x: string) => (x === nid || x.startsWith(`${nid}__iface__`) ? rendered + x.slice(nid.length) : x);

        record(nid, rendered, ancestors);
        for (const itf of leaf.interfaces ?? []) record(itf.id, rename(itf.id), [...ancestors, rendered]);
        if (rendered !== nid) {
            leaf.id = rendered;
            leaf.sourceId = nid;
            leaf.interfaces = leaf.interfaces?.map(itf => ({ ...itf, id: rename(itf.id), sourceId: itf.id }));
        }
        append(attachmentsOf, nid, ...nodeAttachments.map(a => ({ from: rename(a.from), to: rename(a.to) })));
        return leaf;
    };

    const createContainer = (cid: string, rendered: string, ancestors: string[], path: Set<string>): VMContainer => {
        const node = byId.get(cid);
        const container: VMContainer = {
            id: rendered,
            label: labelFor(node, cid),
            nodeType: node?.['node-type'],
            nodes: [],
            containers: [],
        };
        if (rendered !== cid) container.sourceId = cid;
        record(cid, rendered, ancestors);

        const childAncestors = [...ancestors, rendered];
        const childPath = new Set(path).add(cid);
        for (const child of childrenOf.get(cid) ?? []) {
            if (childPath.has(child)) continue;
            const childRendered = drawings(child) > 1 ? copyId(child, rendered) : child;
            if (containerIdsToRender.has(child)) {
                container.containers.push(createContainer(child, childRendered, childAncestors, childPath));
            } else {
                const n = byId.get(child);
                if (n) container.nodes.push(createLeaf(n, childRendered, childAncestors));
            }
        }
        return container;
    };

    const containers = Array.from(containerIdsToRender)
        .filter(cid => renderedParents(cid).length === 0)
        .map(cid => createContainer(cid, cid, [], new Set()));

    for (const n of nodes) {
        const nid = n['unique-id'];
        if (containerIdsToRender.has(nid) || renderedParents(nid).length > 0) continue;
        looseNodes.push(createLeaf(n, nid, []));
    }

    // Input node order keeps the output stable for architectures without shared nodes
    const attachments = nodes.flatMap(n => attachmentsOf.get(n['unique-id']) ?? []);
    return { containers, attachments, looseNodes, instancesOf, ancestorsOf };
}
