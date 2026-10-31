import type { Node, Edge } from 'reactflow';
import type { ValidationIssue } from '../stores/canvas-store';
import { getAbsolutePosition, removeContainment } from '../utils/containment';
import { calmIdOf, hasSharedDrawings, planDelete, reattachEdges, sameMembership, withDescendants } from './node-instances';

/** The canvas after an edit. `reload` is true when the canvas must be rebuilt from the saved file. */
interface CanvasEdit {
    nodes: Node[];
    edges: Edge[];
    reload: boolean;
}

/**
 * Deletes drawings. `deletedNodes` is what React Flow passes: the picked drawings and those nested in them.
 * Edges of a deleted drawing move to a drawing of the same CALM node that remains.
 */
export function deleteDrawings(nodes: Node[], edges: Edge[], deletedNodes: Node[]): CanvasEdit {
    const { deletedIds, keptRoots } = planDelete(deletedNodes, nodes);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    // Measured from the drawing before it left its container
    const moved = new Map(keptRoots.map((n) => [n.id, { ...n, position: getAbsolutePosition(byId.get(n.id)!, nodes) }]));
    const remaining = nodes.filter((n) => !deletedIds.has(n.id)).map((n) => moved.get(n.id) ?? n);
    const touches = (e: Edge) => deletedIds.has(e.source) || deletedIds.has(e.target);
    const removed = nodes.filter((n) => deletedIds.has(n.id));
    return {
        nodes: remaining,
        edges: [...edges.filter((e) => !touches(e)), ...reattachEdges(edges.filter(touches), removed, remaining)],
        reload: hasSharedDrawings(nodes),
    };
}

/** Moves a drawing out of its container. The membership leaves every drawing of it. */
export function unparentDrawing(nodes: Node[], edges: Edge[], nodeId: string): CanvasEdit {
    const node = nodes.find((n) => n.id === nodeId);
    const others = node ? withDescendants(new Set(sameMembership(node, nodes).map((n) => n.id)), nodes) : new Set<string>();
    const remaining = nodes.filter((n) => !others.has(n.id));
    const touches = (e: Edge) => others.has(e.source) || others.has(e.target);
    return {
        nodes: removeContainment(nodeId, remaining),
        edges: [...edges.filter((e) => !touches(e)), ...reattachEdges(edges.filter(touches), nodes.filter((n) => others.has(n.id)), remaining)],
        reload: hasSharedDrawings(nodes),
    };
}

/** The drawing to link to for a drop on `drawingId`: edges stay on the drawing that keeps the CALM id. */
export function linkTargetOf(nodes: Node[], drawingId: string): string {
    const drawing = nodes.find((n) => n.id === drawingId);
    return drawing ? calmIdOf(drawing) : drawingId;
}

/** Puts the error and warning counts of each CALM node on every drawing of it, for the badges. */
export function withIssueCounts(nodes: Node[], issues: ValidationIssue[]): Node[] {
    const counts: Record<string, { errors: number; warnings: number }> = {};
    for (const issue of issues) {
        if (!issue.nodeId) continue;
        const c = counts[issue.nodeId] ?? { errors: 0, warnings: 0 };
        if (issue.severity === 'error') c.errors++;
        else if (issue.severity === 'warning') c.warnings++;
        counts[issue.nodeId] = c;
    }
    return nodes.map((n) => {
        const calmId = calmIdOf(n);
        return {
            ...n,
            data: { ...(n.data as Record<string, unknown>), validationErrors: counts[calmId]?.errors ?? 0, validationWarnings: counts[calmId]?.warnings ?? 0 },
        };
    });
}

/** A pasted copy of `src`: a new, independent CALM node at the top level. */
export function pastedNode(src: Node, newId: string): Node {
    const data = JSON.parse(JSON.stringify(src.data)) as Record<string, unknown>;
    data.calmId = newId;
    data.label = `${data.label ?? ''} (copy)`;
    // Strip resolved definition data and memberships — the copy is independent
    delete data['definition-id'];
    delete data._resolvedControls;
    delete data.validationErrors;
    delete data.validationWarnings;
    delete data.otherParents;

    const isContainer = src.type === 'container';
    return {
        id: newId,
        type: src.type ?? 'system',
        position: { x: src.position.x + 30, y: src.position.y + 30 },
        data,
        ...(isContainer && src.width && src.height
            ? { width: src.width, height: src.height, style: { width: src.width, height: src.height } }
            : {}),
    };
}

/** One drawing per CALM node: the one that keeps the CALM id. */
export function originalsOf(nodes: Node[]): Node[] {
    return nodes.filter((n) => n.id === calmIdOf(n));
}
