import type { SchemaNode } from '@finos/calm-models/pattern';

function isObject(value: unknown): value is SchemaNode {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readUniqueId(node: SchemaNode): string | undefined {
    const properties = node['properties'];
    if (!isObject(properties)) return undefined;
    const uniqueIdSchema = properties['unique-id'];
    if (!isObject(uniqueIdSchema)) return undefined;
    const constValue = uniqueIdSchema['const'];
    return typeof constValue === 'string' ? constValue : undefined;
}

export interface NodeInterface {
    uniqueId: string;
    index: number;
}

/**
 * Reads a node candidate's own `interfaces.prefixItems`, in declaration order, skipping
 * any entry with no `const`-pinned `unique-id` — the same rule `listCandidates` applies
 * to node/relationship candidates themselves.
 */
export function listNodeInterfaces(node: SchemaNode): NodeInterface[] {
    const properties = node['properties'];
    const interfacesSchema = isObject(properties) ? properties['interfaces'] : undefined;
    const prefixItems = isObject(interfacesSchema) && Array.isArray(interfacesSchema['prefixItems'])
        ? (interfacesSchema['prefixItems'] as SchemaNode[])
        : [];

    const result: NodeInterface[] = [];
    prefixItems.forEach((iface, index) => {
        if (!isObject(iface)) return;
        const uniqueId = readUniqueId(iface);
        if (!uniqueId) return;
        result.push({ uniqueId, index });
    });
    return result;
}
