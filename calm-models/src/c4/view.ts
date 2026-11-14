import type { C4Element, C4Model, C4Relationship } from './projection.js';

export type C4Level = 'context' | 'container' | 'component' | 'deployment';

export const C4_LEVELS: readonly C4Level[] = ['context', 'container', 'component', 'deployment'];

export interface C4View {
    level: C4Level;
    /** The element the diagram is about. At container and component level, the boundary around `inside`. */
    scope?: C4Element;
    inside: C4Element[];
    /** Everything else on the diagram. At context level, this includes the scope. */
    outside: C4Element[];
    relationships: C4Relationship[];
    /** Deployment level only: each deployment node and what is deployed in it. */
    deployments?: { node: C4Element; hosted: C4Element[] }[];
}

const DRAWN = new Set(['person', 'software-system', 'container', 'component']);

/** The element's `parent` chain from the top down, ending with the element itself. */
export function c4ChainOf(model: C4Model, id: string): string[] {
    const chain: string[] = [];
    const seen = new Set<string>();
    for (let current: string | undefined = id; current && !seen.has(current); current = model.elements.get(current)?.parent) {
        chain.unshift(current);
        seen.add(current);
    }
    return chain;
}

/**
 * The elements a diagram at this level can be about. Context: the software systems of this architecture, those
 * with something inside them first. Container: software systems with something inside. Component: containers
 * with something inside.
 */
export function c4Scopes(model: C4Model, level: C4Level): C4Element[] {
    const all = [...model.elements.values()];
    const hasChildren = (element: C4Element) =>
        all.some((child) => child.parent === element.id && DRAWN.has(child.kind));
    const ownSystems = all.filter((element) => element.kind === 'software-system' && !element.external.includes('other-team'));
    switch (level) {
    case 'context':
        return [...ownSystems.filter(hasChildren), ...ownSystems.filter((element) => !hasChildren(element))];
    case 'container':
        return ownSystems.filter(hasChildren);
    case 'component':
        return all.filter((element) => element.kind === 'container' && !element.external.includes('other-team') && hasChildren(element));
    default:
        return [];
    }
}

/**
 * Builds one diagram. A relationship moves up to the highest element drawn on the diagram that holds its end,
 * and relationships that then join the same two elements merge into one.
 */
export function c4View(model: C4Model, level: C4Level, scopeId?: string): C4View {
    const element = (id: string) => model.elements.get(id)!;
    const ownedElsewhere = (id: string) => element(id).external.includes('other-team');

    if (level === 'deployment') {
        const hosts = new Set([
            ...model.deployedIn.values(),
            ...[...model.elements.values()].filter((e) => e.kind === 'deployment-node').map((e) => e.id),
        ]);
        const deployments = [...hosts].map((host) => ({
            node: element(host),
            hosted: [...model.deployedIn].filter(([, h]) => h === host).map(([id]) => element(id)),
        }));
        const hosted = new Set(deployments.flatMap((d) => d.hosted.map((h) => h.id)));
        const relationships = lift(model, (id) => (hosted.has(id) ? id : undefined), () => true);
        return { level, inside: [], outside: [], relationships, deployments };
    }

    const scope = scopeId === undefined ? undefined : model.elements.get(scopeId);
    if (!scope) return { level, inside: [], outside: [], relationships: [] };

    // The highest element on the diagram that holds `id`, below the scope's own chain. A node that another
    // team owns stands for everything inside it (rule E3).
    const scopeChain = new Set(level === 'context' ? [] : c4ChainOf(model, scope.id));
    const representative = (id: string) => {
        const chain = c4ChainOf(model, id).filter((c) => !scopeChain.has(c));
        const head = chain.find(ownedElsewhere) ?? chain[0];
        return head && DRAWN.has(element(head).kind) && DRAWN.has(element(id).kind) ? head : undefined;
    };

    if (level === 'context') {
        const relationships = lift(model, representative, (s, t) => s === scope.id || t === scope.id);
        const ids = new Set([scope.id, ...relationships.flatMap((r) => [r.source, r.target])]);
        return { level, scope, inside: [], outside: [...ids].map(element), relationships };
    }

    const isInside = (id: string) => element(id).parent === scope.id && !ownedElsewhere(id);
    const relationships = lift(model, representative, (s, t) => isInside(s) || isInside(t));
    const inside = [...model.elements.values()].filter((e) => isInside(e.id) && DRAWN.has(e.kind));
    const outside = new Set(relationships.flatMap((r) => [r.source, r.target]).filter((id) => !isInside(id)));
    return { level, scope, inside, outside: [...outside].map(element), relationships };
}

function lift(
    model: C4Model,
    representative: (id: string) => string | undefined,
    keep: (source: string, target: string) => boolean
): C4Relationship[] {
    const merged = new Map<string, C4Relationship>();
    for (const relationship of model.relationships) {
        const source = representative(relationship.source);
        const target = representative(relationship.target);
        if (!source || !target || source === target || !keep(source, target)) continue;
        const key = `${source}\u0000${target}`;
        const existing = merged.get(key);
        if (existing) existing.count += relationship.count;
        else merged.set(key, { ...relationship, source, target });
    }
    return [...merged.values()];
}
