import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import type { C4Element, C4Model, C4Relationship, C4View } from '@finos/calm-models/c4';
import { C4_KIND_LABEL } from './c4Display.js';

export const C4_ELEMENT_WIDTH = 230;
export const C4_ELEMENT_HEIGHT = 140;
const BOUNDARY_PADDING = 24;
const BOUNDARY_LABEL_HEIGHT = 40;


export interface C4ElementData extends Record<string, unknown> {
    element: C4Element;
    /** True when a click opens the next level down with this element in scope. */
    canOpen: boolean;
}

export interface C4BoundaryData extends Record<string, unknown> {
    label: string;
    kind: string;
}

export interface C4RelationshipData extends Record<string, unknown> {
    relationship: C4Relationship;
}

interface Group {
    id: string;
    label: string;
    kind: string;
    members: C4Element[];
}

function groupsOf(view: C4View, model: C4Model): { groups: Group[]; loose: C4Element[] } {
    if (view.deployments) {
        return {
            groups: view.deployments.map(({ node, hosted }) => ({
                id: `group:${node.id}`,
                label: node.name,
                kind: `Deployment Node${node.nodeType ? `: ${node.nodeType}` : ''}`,
                members: hosted,
            })),
            loose: [],
        };
    }
    if (view.level !== 'context' && view.scope) {
        const scope = view.scope;
        return {
            groups: [{ id: `group:${scope.id}`, label: scope.name, kind: C4_KIND_LABEL[scope.kind] ?? scope.kind, members: view.inside }],
            loose: view.outside,
        };
    }
    const boundary = [...model.elements.values()].find((e) => e.kind === 'enterprise-boundary');
    if (!boundary) return { groups: [], loose: view.outside };
    const inEnterprise = (e: C4Element) => !e.external.includes('outside-enterprise') && !e.external.includes('mapped-external');
    return {
        groups: [{ id: `group:${boundary.id}`, label: boundary.name, kind: 'Enterprise', members: view.outside.filter(inEnterprise) }],
        loose: view.outside.filter((e) => !inEnterprise(e)),
    };
}

function handlesFor(source: { x: number; y: number }, target: { x: number; y: number }) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    if (Math.abs(dy) >= Math.abs(dx) * 0.6) {
        return dy > 0 ? { sourceHandle: 'b-s', targetHandle: 't-t' } : { sourceHandle: 't-s', targetHandle: 'b-t' };
    }
    return dx > 0 ? { sourceHandle: 'r-s', targetHandle: 'l-t' } : { sourceHandle: 'l-s', targetHandle: 'r-t' };
}

/**
 * Lays a view out, left to right or, for a narrow screen, top to bottom. Each boundary is a dagre cluster. dagre
 * ignores cluster padding, so a boundary is drawn around the extent of its members, with room for its label.
 */
export function layoutC4View(
    view: C4View,
    model: C4Model,
    canOpen: (id: string) => boolean,
    direction: 'LR' | 'TB' = 'LR',
): { nodes: Node[]; edges: Edge[] } {
    const { groups, loose } = groupsOf(view, model);
    const g = new dagre.graphlib.Graph({ compound: true });
    g.setGraph({ rankdir: direction, nodesep: 80, ranksep: direction === 'LR' ? 180 : 120, marginx: 20, marginy: 40 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const group of groups) {
        if (group.members.length === 0) continue;
        g.setNode(group.id, {});
        for (const member of group.members) {
            g.setNode(member.id, { width: C4_ELEMENT_WIDTH, height: C4_ELEMENT_HEIGHT });
            g.setParent(member.id, group.id);
        }
    }
    for (const element of loose) g.setNode(element.id, { width: C4_ELEMENT_WIDTH, height: C4_ELEMENT_HEIGHT });
    for (const relationship of view.relationships) {
        if (g.hasNode(relationship.source) && g.hasNode(relationship.target)) g.setEdge(relationship.source, relationship.target);
    }
    dagre.layout(g);

    const nodes: Node[] = [];
    for (const group of groups) {
        if (group.members.length === 0) continue;
        const members = group.members.map((member) => g.node(member.id));
        const left = Math.min(...members.map((m) => m.x)) - C4_ELEMENT_WIDTH / 2 - BOUNDARY_PADDING;
        const top = Math.min(...members.map((m) => m.y)) - C4_ELEMENT_HEIGHT / 2 - BOUNDARY_PADDING;
        const right = Math.max(...members.map((m) => m.x)) + C4_ELEMENT_WIDTH / 2 + BOUNDARY_PADDING;
        const bottom = Math.max(...members.map((m) => m.y)) + C4_ELEMENT_HEIGHT / 2 + BOUNDARY_PADDING + BOUNDARY_LABEL_HEIGHT;
        nodes.push({
            id: group.id,
            type: 'c4boundary',
            position: { x: left, y: top },
            width: right - left,
            height: bottom - top,
            data: { label: group.label, kind: group.kind } satisfies C4BoundaryData,
            zIndex: -1,
            selectable: false,
            draggable: false,
        });
    }
    const centres = new Map<string, { x: number; y: number }>();
    for (const element of [...groups.flatMap((group) => group.members), ...loose]) {
        const box = g.node(element.id);
        centres.set(element.id, { x: box.x, y: box.y });
        nodes.push({
            id: element.id,
            type: 'c4element',
            position: { x: box.x - C4_ELEMENT_WIDTH / 2, y: box.y - C4_ELEMENT_HEIGHT / 2 },
            data: { element, canOpen: canOpen(element.id) } satisfies C4ElementData,
        });
    }
    const edges: Edge[] = view.relationships
        .filter((r) => centres.has(r.source) && centres.has(r.target))
        .map((relationship) => ({
            id: `${relationship.source}->${relationship.target}`,
            source: relationship.source,
            target: relationship.target,
            type: 'c4relationship',
            ...handlesFor(centres.get(relationship.source)!, centres.get(relationship.target)!),
            markerEnd: { type: 'arrowclosed' as const },
            data: { relationship } satisfies C4RelationshipData,
        }));
    return { nodes, edges };
}
