import type { ParsedSvgGraph, ImportResult, SvgNode } from './types';
import { mapShapeToNodeType } from './shape-mapper';

export function buildCalmJson(graph: ParsedSvgGraph): ImportResult {
    const warnings: string[] = [];
    const nodeIdMap = new Map<string, string>();

    const nodes = graph.nodes.map((n, i) => {
        const { name, description } = splitLabel(n.label);
        const isContainer = isContainerNode(n);
        const nodeType = isContainer ? 'network' : mapShapeToNodeType(n.shapeHint, name);
        const calmId = generateCalmId(nodeType, name, i);
        nodeIdMap.set(n.id, calmId);

        const node: Record<string, unknown> = {
            'unique-id': calmId,
            'node-type': nodeType,
            name: name || `Unnamed ${nodeType} ${i + 1}`,
            description,
        };

        const style = extractNodeStyle(n.styleProps);
        if (style) {
            node.metadata = { 'fidelity-style': style };
        }

        return node;
    });

    const relationships: Array<Record<string, unknown>> = [];
    let relIndex = 0;

    // Edges → connects relationships
    for (const edge of graph.edges) {
        const source = nodeIdMap.get(edge.sourceId);
        const target = nodeIdMap.get(edge.targetId);
        if (!source || !target) {
            warnings.push(`Edge "${edge.id}": could not resolve source or target node`);
            continue;
        }
        const rel: Record<string, unknown> = {
            'unique-id': `rel-${++relIndex}`,
            'relationship-type': {
                connects: {
                    source: { node: source },
                    destination: { node: target },
                },
            },
        };
        if (edge.label) rel.description = edge.label;
        relationships.push(rel);
    }

    // Containment → deployed-in relationships
    const containerChildren = new Map<string, string[]>();

    // First: use explicit parentId references
    for (const node of graph.nodes) {
        if (node.parentId) {
            const parentCalmId = nodeIdMap.get(node.parentId);
            const childCalmId = nodeIdMap.get(node.id);
            if (parentCalmId && childCalmId) {
                if (!containerChildren.has(parentCalmId)) {
                    containerChildren.set(parentCalmId, []);
                }
                containerChildren.get(parentCalmId)!.push(childCalmId);
            }
        }
    }

    // Second: geometry-based containment for nodes without explicit parents
    const nodesWithParent = new Set(graph.nodes.filter(n => n.parentId).map(n => n.id));
    const containerCandidates = graph.nodes.filter(n => isContainerNode(n));
    for (const child of graph.nodes) {
        if (nodesWithParent.has(child.id)) continue;
        const bestContainer = findSmallestContainer(child, containerCandidates);
        if (bestContainer) {
            const parentCalmId = nodeIdMap.get(bestContainer.id)!;
            const childCalmId = nodeIdMap.get(child.id)!;
            if (!containerChildren.has(parentCalmId)) {
                containerChildren.set(parentCalmId, []);
            }
            containerChildren.get(parentCalmId)!.push(childCalmId);
        }
    }

    for (const [container, children] of containerChildren) {
        relationships.push({
            'unique-id': `rel-${++relIndex}`,
            'relationship-type': {
                'deployed-in': { container, nodes: children },
            },
        });
    }

    // Build layout metadata from geometry
    const layout: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const n of graph.nodes) {
        const calmId = nodeIdMap.get(n.id);
        if (calmId) {
            layout[calmId] = {
                x: Math.round(n.geometry.x),
                y: Math.round(n.geometry.y),
                w: Math.round(n.geometry.width),
                h: Math.round(n.geometry.height),
            };
        }
    }

    const calmDoc = {
        $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
        nodes,
        relationships,
        metadata: { _layout: layout },
    };

    return {
        json: JSON.stringify(calmDoc, null, 2),
        nodeCount: nodes.length,
        relationshipCount: relationships.length,
        warnings,
    };
}

function splitLabel(label: string): { name: string; description: string } {
    const lines = label.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return { name: label.trim(), description: '' };
    return { name: lines[0]!, description: lines.slice(1).join(' ') };
}

function extractNodeStyle(styleProps: SvgNode['styleProps']): { background?: string; text?: string } | null {
    const bg = styleProps.fillColor || styleProps.fill;
    const text = styleProps.fontColor || styleProps.color;

    if (!bg && !text) return null;

    const style: { background?: string; text?: string } = {};
    if (bg && bg !== 'none' && bg !== 'default') style.background = bg;
    if (text && text !== 'none' && text !== 'default') style.text = text;

    return Object.keys(style).length > 0 ? style : null;
}

function generateCalmId(nodeType: string, label: string, index: number): string {
    const slug = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (slug) return `${nodeType}-${slug}`;
    return `${nodeType}-${index + 1}`;
}

function isContainerNode(node: SvgNode): boolean {
    const { fillColor, fill, dashed } = node.styleProps;
    const noFill = !fillColor || fillColor === 'none';
    const noFill2 = !fill || fill === 'none';
    const isDashed = dashed === '1';
    // Container: large, dashed border, no fill (boundary-only)
    if (isDashed && noFill && noFill2 && node.geometry.width >= 200 && node.geometry.height >= 150) {
        return true;
    }
    return false;
}

function isFullyInside(child: SvgNode, container: SvgNode): boolean {
    if (child.id === container.id) return false;
    const cg = child.geometry;
    const pg = container.geometry;
    const margin = 5;
    return (
        cg.x >= pg.x - margin &&
        cg.y >= pg.y - margin &&
        cg.x + cg.width <= pg.x + pg.width + margin &&
        cg.y + cg.height <= pg.y + pg.height + margin
    );
}

function findSmallestContainer(child: SvgNode, candidates: SvgNode[]): SvgNode | null {
    let best: SvgNode | null = null;
    let bestArea = Infinity;
    for (const candidate of candidates) {
        if (!isFullyInside(child, candidate)) continue;
        const area = candidate.geometry.width * candidate.geometry.height;
        if (area < bestArea) {
            bestArea = area;
            best = candidate;
        }
    }
    return best;
}
