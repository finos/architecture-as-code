import path from 'path';
import { printTree } from 'tree-dump';
import type { DependencyGraph } from './bundle';

/**
 * Render a DependencyGraph into a tree string using tree-dump.
 * Returns the formatted string (does not log).
 */
export function renderGraphAsTree(graph: DependencyGraph, bundlePath: string): string {
    const nodes = graph.nodes;
    const edges = graph.edges;

    // compute incoming counts to find roots
    const incoming = new Map<string, number>();
    for (const n of nodes) incoming.set(n, 0);
    for (const [, tos] of Object.entries(edges)) {
        for (const t of tos) {
            incoming.set(t, (incoming.get(t) ?? 0) + 1);
        }
    }

    const roots = nodes.filter(n => (incoming.get(n) ?? 0) === 0);
    const startNodes = roots.length > 0 ? roots : nodes;

    function buildSubtree(id: string, seen = new Set<string>()): Record<string, any> {
        const relativePath = path.relative(bundlePath, graph.idToPath[id]);
        const key = `${id} (${relativePath ? './' + relativePath : '.'})`;
        if (seen.has(id)) {
            return { [key]: { '(cycle)': {} } };
        }
        seen.add(id);
        const children = edges[id] || [];
        const childObj: Record<string, any> = {};
        for (const childId of children) {
            Object.assign(childObj, buildSubtree(childId, new Set(seen)));
        }
        return { [key]: childObj };
    }

    const treeObj: Record<string, any> = {};
    for (const id of startNodes) {
        Object.assign(treeObj, buildSubtree(id));
    }

    function nestedObjectToChildren(obj: Record<string, any>): Array<(tab: string) => string> {
        return Object.entries(obj).map(([key, childObj]) => {
            const children = childObj && typeof childObj === 'object' && Object.keys(childObj).length
                ? nestedObjectToChildren(childObj as Record<string, any>)
                : [];
            return (tab: string) => {
                if (children.length === 0) return key;
                return key + printTree(tab, children);
            };
        });
    }

    const children = nestedObjectToChildren(treeObj);
    return printTree('', children);
}

/**
 * Convenience: render and print the tree to stdout.
 */
export function printBundleTreeFromGraph(graph: DependencyGraph, bundlePath: string): void {
    const out = renderGraphAsTree(graph, bundlePath);
    console.log(out);
}
