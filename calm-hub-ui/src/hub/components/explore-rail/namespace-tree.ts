import { NamespaceCounts } from '../../../model/counts.js';

/**
 * One row of the dot-prefix namespace tree. `total` is `null` for a synthetic
 * grouping-only node — a path segment that is not itself a namespace, only an
 * ancestor of one (e.g. `platform` when only `platform.payments.ledger` exists).
 */
export interface NamespaceTreeNode {
    /** Full dot-separated path, e.g. `finos.calm`. */
    path: string;
    /** Last path segment — what a row shows outside filter mode. */
    segment: string;
    total: number | null;
    children: NamespaceTreeNode[];
}

interface TrieNode {
    total: number | null;
    children: Map<string, TrieNode>;
}

function toTreeNode(segment: string, path: string, trie: TrieNode): NamespaceTreeNode {
    const children = [...trie.children.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([childSegment, childTrie]) => toTreeNode(childSegment, `${path}.${childSegment}`, childTrie));
    return { path, segment, total: trie.total, children };
}

/**
 * Builds the dot-prefix trie, one row per segment — no path compression.
 * `platform.payments.ledger` renders as three rows: `platform` and
 * `platform.payments` are group-only (`total: null`), `ledger` carries the count.
 */
export function buildNamespaceTree(namespaceCounts: NamespaceCounts[]): NamespaceTreeNode[] {
    const root: TrieNode = { total: null, children: new Map() };
    for (const nc of namespaceCounts) {
        const segments = (nc.namespace ?? '').split('.').filter(Boolean);
        if (segments.length === 0) continue;
        let current = root;
        for (const segment of segments) {
            let child = current.children.get(segment);
            if (!child) {
                child = { total: null, children: new Map() };
                current.children.set(segment, child);
            }
            current = child;
        }
        current.total = nc.total;
    }
    return [...root.children.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([segment, trie]) => toTreeNode(segment, segment, trie));
}

/**
 * Pixels of indent per nesting level, shared by the rail, the fly-out and the
 * mobile drill-down so a row sits at the same depth on every surface. Small
 * enough that a deep tree still leaves room for the label — a cap would make
 * two different depths render identically.
 */
export const INDENT_STEP = 8;

/** Left indent for a row at `depth`, in pixels. */
export function indentFor(depth: number): number {
    return depth * INDENT_STEP;
}

/** True when the node is a real namespace rather than a synthetic grouping-only ancestor. */
export function isNamespace(node: NamespaceTreeNode): boolean {
    return node.total !== null;
}

/** Strict ancestor paths of `path`, nearest root first — excludes `path` itself. */
export function ancestorPathsOf(path: string): string[] {
    const segments = path.split('.');
    const ancestors: string[] = [];
    for (let i = 1; i < segments.length; i++) {
        ancestors.push(segments.slice(0, i).join('.'));
    }
    return ancestors;
}

/**
 * Paths that match `needle` (assumed already lower-cased) plus their strict
 * ancestors — a matching parent brings its subtree along for free, since
 * `'finos.calm'.includes(needle)` whenever `'finos'.includes(needle)`.
 */
export function filterNamespaceTree(tree: NamespaceTreeNode[], needle: string): Set<string> {
    const visible = new Set<string>();
    if (!needle) return visible;

    const visit = (nodes: NamespaceTreeNode[]) => {
        for (const node of nodes) {
            if (node.path.toLowerCase().includes(needle)) {
                visible.add(node.path);
                for (const ancestor of ancestorPathsOf(node.path)) {
                    visible.add(ancestor);
                }
            }
            visit(node.children);
        }
    };
    visit(tree);
    return visible;
}

function sumDescendantTotals(node: NamespaceTreeNode): number {
    let sum = 0;
    for (const child of node.children) {
        sum += (child.total ?? 0) + sumDescendantTotals(child);
    }
    return sum;
}

/** One rendered row: the node, its indent depth, and the state {@link flattenNamespaceTree} derived for it. */
export interface NamespaceRow {
    node: NamespaceTreeNode;
    depth: number;
    hasChildren: boolean;
    /** Only ever true outside filter mode — filtering ignores the collapsed set entirely. */
    collapsed: boolean;
    /** Sum of every namespace total under this node, excluding its own — the ghost `+N` count. */
    descendantTotal: number;
}

interface FlattenOptions {
    /** Full paths the user has collapsed. Read only outside filter mode. */
    collapsed: ReadonlySet<string>;
    filtering: boolean;
    /** From {@link filterNamespaceTree}. Ignored outside filter mode. */
    visible: ReadonlySet<string>;
}

/**
 * Flattens the tree into render order (depth-first, children already sorted).
 * Browse mode respects the collapsed set; filter mode ignores it and emits
 * every node in `visible`, regardless of collapse state.
 */
export function flattenNamespaceTree(tree: NamespaceTreeNode[], opts: FlattenOptions): NamespaceRow[] {
    const rows: NamespaceRow[] = [];

    const visit = (nodes: NamespaceTreeNode[], depth: number) => {
        for (const node of nodes) {
            if (opts.filtering) {
                if (!opts.visible.has(node.path)) continue;
                rows.push({ node, depth, hasChildren: node.children.length > 0, collapsed: false, descendantTotal: sumDescendantTotals(node) });
                visit(node.children, depth + 1);
                continue;
            }

            const collapsed = opts.collapsed.has(node.path);
            rows.push({ node, depth, hasChildren: node.children.length > 0, collapsed, descendantTotal: sumDescendantTotals(node) });
            if (!collapsed) {
                visit(node.children, depth + 1);
            }
        }
    };
    visit(tree, 0);
    return rows;
}

/** Splits `label` around the first case-insensitive occurrence of `needle`, for `<mark>` highlighting. */
export function splitOnMatch(label: string, needle: string): { prefix: string; match: string; suffix: string } | null {
    if (!needle) return null;
    const idx = label.toLowerCase().indexOf(needle.toLowerCase());
    if (idx === -1) return null;
    return {
        prefix: label.slice(0, idx),
        match: label.slice(idx, idx + needle.length),
        suffix: label.slice(idx + needle.length),
    };
}
