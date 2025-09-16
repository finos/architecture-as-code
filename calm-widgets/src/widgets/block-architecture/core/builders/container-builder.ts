import { CalmNodeCanonicalModel } from '@finos/calm-models/canonical';
import { VMContainer, VMLeafNode, VMAttach } from '../../types';
import { labelFor } from '../utils';
import { VMFactoryProvider } from '../factories/factory-provider';

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

/**
 * Builds the container forest structure for the view model. Creates VM containers
 * for each container ID, places nodes into their appropriate containers based on
 * the parent map, and handles interface rendering if enabled. Returns the root
 * containers, interface attachments, and any loose nodes that don't belong to containers.
 */
export function buildContainerForest(
    nodes: CalmNodeCanonicalModel[],
    parentOf: Map<string, string>,
    containerIdsToRender: Set<string>,
    renderInterfaces: boolean
): { containers: VMContainer[]; attachments: VMAttach[]; looseNodes: VMLeafNode[] } {
    const byId = new Map(nodes.map(n => [n['unique-id'], n] as const));
    const attachments: VMAttach[] = [];
    const looseNodes: VMLeafNode[] = [];
    const nodeFactory = VMFactoryProvider.getNodeFactory();

    const vmContainers = new Map<string, VMContainer>();
    for (const id of containerIdsToRender) {
        const node = byId.get(id);
        vmContainers.set(id, {
            id,
            label: labelFor(node, id),
            nodes: [],
            containers: [],
        });
    }

    // Place nodes into containers when their parent is rendered; otherwise treat as loose
    for (const n of nodes) {
        const nid = n['unique-id'];
        if (containerIdsToRender.has(nid)) continue; // a container id itself
        const pid = parentOf.get(nid);
        if (pid && containerIdsToRender.has(pid)) {
            const cont = vmContainers.get(pid);
            if (cont) {
                const { node: leafNode, attachments: nodeAttachments } = nodeFactory.createLeafNode(n, renderInterfaces);
                cont.nodes.push(leafNode);
                attachments.push(...nodeAttachments);
            }
        } else {
            const { node: leafNode, attachments: nodeAttachments } = nodeFactory.createLeafNode(n, renderInterfaces);
            looseNodes.push(leafNode);
            attachments.push(...nodeAttachments);
        }
    }

    // Attach container → container for rendered containers
    for (const [child, parent] of parentOf.entries()) {
        if (!containerIdsToRender.has(child)) continue;
        const p = vmContainers.get(parent);
        const c = vmContainers.get(child);
        if (p && c) p.containers.push(c);
    }

    const roots = Array.from(containerIdsToRender).filter(cid => !parentOf.get(cid));
    const containers = roots.map(r => vmContainers.get(r)!).filter(Boolean);
    return { containers, attachments, looseNodes };
}
