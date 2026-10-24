import path from 'path';
import { printTree } from 'tree-dump';
import { readFile } from 'fs/promises';
import { extractAllReferences, loadManifest, resolveFilePath } from './bundle';
import { buildRefRulesFromDiskIds, findRuleForRef } from './ref-rewrite';

export type DependencyGraph = {
    nodes: string[]; // ids
    edges: Record<string, string[]>; // id -> referenced ids
    idToPath: Record<string, string>;
};

interface TreeNode {
    [key: string]: TreeNode;
}

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

    function buildSubtree(id: string, seen = new Set<string>()): TreeNode {
        const relativePath = path.relative(bundlePath, graph.idToPath[id]);
        // Files in the 'files/' directory were pulled, show (pulled) instead of full path
        const isPulled = relativePath.startsWith('files' + path.sep) || relativePath.startsWith('files/');
        const pathDisplay = isPulled ? 'pulled' : (relativePath ? './' + relativePath : '.');
        const key = `${id} (${pathDisplay})`;
        if (seen.has(id)) {
            return { [key]: { '(cycle)': {} } };
        }
        seen.add(id);
        const children = edges[id] || [];
        const childObj: TreeNode = {};
        for (const childId of children) {
            Object.assign(childObj, buildSubtree(childId, new Set(seen)));
        }
        return { [key]: childObj };
    }

    const treeObj: TreeNode = {};
    for (const id of startNodes) {
        Object.assign(treeObj, buildSubtree(id));
    }

    function nestedObjectToChildren(obj: TreeNode): Array<(tab: string) => string> {
        return Object.entries(obj).map(([key, childObj]) => {
            const children = childObj && typeof childObj === 'object' && Object.keys(childObj).length
                ? nestedObjectToChildren(childObj)
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

/**
 * Build a dependency graph for the bundle where edges point from a document id to other document ids it references.
 * Only references that resolve to ids present in the bundle manifest are included as edges.
 * A CalmHub `$id` at any version matches, as for `bump`.
 */
export async function buildDependencyGraph(bundlePath: string): Promise<DependencyGraph> {
    const manifest = await loadManifest(bundlePath);
    const idToPath: Record<string, string> = {};
    for (const [id, entry] of Object.entries(manifest)) {
        idToPath[id] = resolveFilePath(bundlePath, entry.path);
    }

    const rules = await buildRefRulesFromDiskIds(manifest, bundlePath);
    const edges: Record<string, string[]> = {};

    for (const id of Object.keys(manifest)) {
        const filePath = idToPath[id];
        let json: object;
        try {
            const raw = await readFile(filePath, 'utf8');
            json = JSON.parse(raw) as object;
        } catch (_) {
            // skip unreadable files
            continue;
        }

        const refs = extractAllReferences(json);

        const targets = new Set<string>();
        for (const ref of refs) {
            const refBase = ref.split('#')[0];
            // direct id match
            if (manifest[ref]) {
                targets.add(ref);
                continue;
            }
            // match by base (strip fragment)
            if (manifest[refBase]) {
                targets.add(refBase);
                continue;
            }
            const rule = findRuleForRef(ref, rules);
            if (rule) {
                targets.add(rule.bareId);
                continue;
            }
            if (refBase.startsWith('http://') || refBase.startsWith('https://')) {
                continue;
            }
            // resolve relative to bundlePath
            const candidatePath: string = path.resolve(bundlePath, refBase);
            const match = Object.entries(idToPath).find(([, p]) => path.resolve(p) === candidatePath);
            if (match) {
                targets.add(match[0]);
            }
        }
        // A document can $ref its own $id (e.g. "<$id>#/defs/..."); that is not a dependency.
        targets.delete(id);
        edges[id] = [...targets];
    }

    return { nodes: Object.keys(manifest), edges, idToPath };
}

/**
 * Print the dependency tree for the bundle to stdout.
 * Starts from nodes with no incoming edges by default.
 */
export async function printBundleTree(bundlePath: string): Promise<void> {
    const graph = await buildDependencyGraph(bundlePath);
    printBundleTreeFromGraph(graph, bundlePath);
}
