export function instantiateFromPattern(schema: unknown): any {
    const p = schema as any;

    const nodes = (p?.properties?.nodes?.prefixItems ?? [])
        .map((entry: any) => firstBuildable(entry))
        .filter(Boolean)
        .map((n: any) => {
            if (!n['unique-id']) n['unique-id'] = '[[PLACEHOLDER]]';
            if (!n['node-type']) n['node-type'] = 'system';
            if (!n['name']) n['name'] = '[[PLACEHOLDER]]';
            return n;
        });

    const built = new Set<string>(nodes.map((n: any) => n['unique-id']));
    const relationships = (p?.properties?.relationships?.prefixItems ?? [])
        .map((entry: any) => firstBuildable(entry, (r) => endpointsOf(r).every((id) => built.has(id))))
        .filter(Boolean)
        .map((r: any) => {
            if (!r['unique-id']) r['unique-id'] = '[[PLACEHOLDER]]';
            if (!r['relationship-type']) r['relationship-type'] = {};
            return r;
        });

    return { nodes, relationships };
}

/**
 * The declaration a position is built from. Where it offers alternatives the first one that
 * builds wins, except that a relationship prefers an alternative naming only nodes already
 * built — the two catalogues are read separately, so the first of each can disagree and leave
 * a relationship pointing at a node that is not there.
 */
function firstBuildable(entry: any, prefer?: (built: any) => boolean): any {
    const candidates = alternativesOf(entry).map(instantiate).filter(Boolean);
    return (prefer && candidates.find(prefer)) || candidates[0] || null;
}

/** Every leaf declaration an entry offers, flattening nested `oneOf`/`anyOf`. */
function alternativesOf(schema: any): any[] {
    const alternatives = schema?.oneOf?.length ? schema.oneOf : schema?.anyOf?.length ? schema.anyOf : null;
    return alternatives ? alternatives.flatMap(alternativesOf) : [schema];
}

function instantiate(schema: any): any {
    return schema?.properties ? instantiateObject(schema.properties) : null;
}

/** The nodes a relationship names, across the four relationship types that name any. */
function endpointsOf(relationship: any): string[] {
    const type = relationship?.['relationship-type'] ?? {};
    const connects = type['connects'];
    const endpoints: unknown[] = [connects?.source?.node, connects?.destination?.node];

    for (const key of ['interacts', 'deployed-in', 'composed-of']) {
        const body = type[key];
        if (!body) continue;
        endpoints.push(body.actor, body.container, ...(Array.isArray(body.nodes) ? body.nodes : []));
    }

    return endpoints.filter((id): id is string => typeof id === 'string');
}

function instantiateObject(properties: Record<string, any>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(properties)) {
        if (key.startsWith('$') || key === 'type') continue;
        result[key] = extractValue(schema);
    }
    return result;
}

function extractValue(schema: any): unknown {
    if (schema.const !== undefined) return schema.const;
    if (schema.default !== undefined) return schema.default;
    if (schema.properties) return instantiateObject(schema.properties);
    if (schema.prefixItems) return schema.prefixItems.map(extractValue);
    if (schema.type === 'string') return '[[PLACEHOLDER]]';
    if (schema.type === 'integer' || schema.type === 'number') return -1;
    if (schema.type === 'boolean') return false;
    if (schema.type === 'array') return [];
    if (schema.type === 'object') return {};
    return '[[PLACEHOLDER]]';
}
