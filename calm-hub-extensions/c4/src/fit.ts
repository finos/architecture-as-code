// The limits of lens.schema.json for hubApi 0. Hub refuses the whole reply when one field is over its limit.
const MAX = { id: 128, calm: 256, calmIds: 32, label: 200, text: 500, technology: 200, title: 200, param: 128, itemLabel: 100, items: 200 } as const;

/** Cuts text to `max` UTF-16 units, as Hub counts them, and marks the cut with an ellipsis. */
export function clip(value: string, max: number): string {
    if (value.length <= max) return value;
    const end = /[\uD800-\uDBFF]/.test(value[max - 2]) ? max - 2 : max - 1;
    return `${value.slice(0, end)}…`;
}

function hash(value: string): string {
    // FNV-1a, two 32-bit lanes. A clash is resolved by the allocator, so this only spreads the ids.
    let a = 0x811c9dc5, b = 0x01000193;
    for (let i = 0; i < value.length; i++) {
        const c = value.charCodeAt(i);
        a = Math.imul(a ^ c, 0x01000193) >>> 0;
        b = Math.imul(b ^ c, 0x811c9dc5) >>> 0;
    }
    return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

/**
 * Gives each id of a reply a lens id of at most 128 units. Ids that fit keep their value, and a long id gets a short
 * one that no other id of the reply uses, so every reference to it stays joined to it alone.
 */
function idAllocator(ids: Iterable<string>): (id: string) => string {
    const all = [...new Set(ids)];
    const used = new Set(all.filter((id) => id.length <= MAX.id));
    const short = new Map<string, string>();
    for (const id of all.filter((id) => id.length > MAX.id)) {
        let candidate = `${clip(id, 100)}#${hash(id)}`;
        for (let n = 2; used.has(candidate); n++) candidate = `${clip(id, 100)}#${hash(id)}-${n}`;
        used.add(candidate);
        short.set(id, candidate);
    }
    return (id) => short.get(id) ?? id;
}

const fitCalm = (calm?: string[]) => calm?.filter((id) => id.length <= MAX.calm).slice(0, MAX.calmIds);
const fitsParams = (params: Record<string, string>) => Object.values(params).every((value) => value.length <= MAX.param);

interface Fittable {
    title: string;
    graph: {
        groups: { id: string; label: string; parent?: string; calm?: string[] }[];
        nodes: { id: string; label: string; metadata?: string; description?: string; tooltip?: string; group?: string; calm?: string[]; link?: { params: Record<string, string> } }[];
        edges: { id: string; source: string; target: string; label?: string; technology?: string; tooltip?: string; calm?: string[] }[];
    };
    controls: { value?: string; items: { value: string; label: string }[] }[];
}

/** Keeps a reply inside the limits of the lens schema, whatever the length of the CALM text and ids. */
export function fitLensReply<R extends Fittable>(reply: R): R {
    const { groups: rawGroups, nodes: rawNodes, edges: rawEdges } = reply.graph;
    const fitId = idAllocator([
        ...rawGroups.flatMap((group) => [group.id, ...(group.parent === undefined ? [] : [group.parent])]),
        ...rawNodes.flatMap((node) => [node.id, ...(node.group === undefined ? [] : [node.group])]),
        ...rawEdges.flatMap((edge) => [edge.id, edge.source, edge.target]),
    ]);
    const groups = rawGroups.map(({ calm, ...group }) => ({
        ...group,
        id: fitId(group.id),
        label: clip(group.label || group.id, MAX.label),
        ...(group.parent !== undefined && { parent: fitId(group.parent) }),
        ...(fitCalm(calm)?.length && { calm: fitCalm(calm) }),
    }));
    const nodes = rawNodes.map(({ calm, link, ...node }) => ({
        ...node,
        id: fitId(node.id),
        label: clip(node.label || node.id, MAX.label),
        ...(node.metadata !== undefined && { metadata: clip(node.metadata, MAX.text) }),
        ...(node.description !== undefined && { description: clip(node.description, MAX.text) }),
        ...(node.tooltip !== undefined && { tooltip: clip(node.tooltip, MAX.text) }),
        ...(node.group !== undefined && { group: fitId(node.group) }),
        ...(fitCalm(calm)?.length && { calm: fitCalm(calm) }),
        // A scope that is too long for a view parameter cannot be opened.
        ...(link && fitsParams(link.params) && { link }),
    }));
    const edges = rawEdges.map(({ calm, ...edge }) => ({
        ...edge,
        id: fitId(edge.id),
        source: fitId(edge.source),
        target: fitId(edge.target),
        ...(edge.label !== undefined && { label: clip(edge.label, MAX.text) }),
        ...(edge.technology !== undefined && { technology: clip(edge.technology, MAX.technology) }),
        ...(edge.tooltip !== undefined && { tooltip: clip(edge.tooltip, MAX.text) }),
        ...(fitCalm(calm)?.length && { calm: fitCalm(calm) }),
    }));
    const controls = reply.controls.flatMap((control) => {
        if (control.value !== undefined && control.value.length > MAX.param) return [];
        const fitting = control.items.filter((item) => item.value !== '' && item.value.length <= MAX.param);
        // A list over the limit keeps its first items and the item that is open.
        const open = fitting.find((item) => item.value === control.value);
        const kept = fitting.length <= MAX.items ? fitting
            : [...fitting.filter((item) => item !== open).slice(0, open ? MAX.items - 1 : MAX.items), ...(open ? [open] : [])];
        const items = kept.map((item) => ({ ...item, label: clip(item.label || item.value, MAX.itemLabel) }));
        return items.length > 0 ? [{ ...control, items }] : [];
    });
    return { ...reply, title: clip(reply.title, MAX.title), graph: { groups, nodes, edges }, controls } as R;
}
