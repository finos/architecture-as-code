export function instantiateFromPattern(schema: unknown): any {
    const p = schema as any;
    const nodeSchemas = declarations(p?.properties?.nodes);
    const relSchemas = declarations(p?.properties?.relationships);

    const nodes = nodeSchemas.map((s: any) => instantiateNode(s)).filter(Boolean).map((n: any) => {
        if (!n['unique-id']) n['unique-id'] = '[[PLACEHOLDER]]';
        if (!n['node-type']) n['node-type'] = 'system';
        if (!n['name']) n['name'] = '[[PLACEHOLDER]]';
        return n;
    });

    const relationships = relSchemas.map((s: any) => instantiateRel(s)).filter(Boolean).map((r: any) => {
        if (!r['unique-id']) r['unique-id'] = '[[PLACEHOLDER]]';
        if (!r['relationship-type']) r['relationship-type'] = {};
        return r;
    });

    return { nodes, relationships };
}

/**
 * A catalogue only counts when it offers alternatives. `items` applies one schema to every
 * position after the entries, so a member declared directly there is not a choice.
 */
function declarations(field: any): any[] {
    const catalogue = field?.items;
    const offersChoice = catalogue?.oneOf?.length || catalogue?.anyOf?.length;
    return [...(field?.prefixItems ?? []), ...(offersChoice ? [catalogue] : [])];
}

function instantiateNode(schema: any): any {
    if (schema.oneOf?.length) return instantiateNode(schema.oneOf[0]);
    if (schema.anyOf?.length) return instantiateNode(schema.anyOf[0]);
    if (!schema.properties) return null;
    return instantiateObject(schema.properties);
}

function instantiateRel(schema: any): any {
    if (schema.oneOf?.length) return instantiateRel(schema.oneOf[0]);
    if (schema.anyOf?.length) return instantiateRel(schema.anyOf[0]);
    if (!schema.properties) return null;
    return instantiateObject(schema.properties);
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
