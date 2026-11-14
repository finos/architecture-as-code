import type { C4ArchitectureInput } from './projection.js';

type Relationship = NonNullable<C4ArchitectureInput['relationships']>[number];

/**
 * Rule 5: adds the nodes of each loaded `detailed-architecture` one level down, composed into the node that
 * links to it. `details` maps a node id to the architecture its link names. Ids of the added nodes and
 * relationships get the prefix `<node id>/` so they cannot clash with the parent document.
 */
export function withDetailedArchitectures(
    architecture: C4ArchitectureInput,
    details: Record<string, C4ArchitectureInput>
): C4ArchitectureInput {
    const nodes = [...(architecture.nodes ?? [])];
    const relationships = [...(architecture.relationships ?? [])];
    const known = new Set(nodes.map((node) => node['unique-id']));
    for (const [parent, child] of Object.entries(details)) {
        if (!known.has(parent)) continue;
        const prefix = (id: string) => `${parent}/${id}`;
        const childNodes = child.nodes ?? [];
        nodes.push(...childNodes.map((node) => ({ ...node, 'unique-id': prefix(node['unique-id']) })));
        relationships.push({
            'unique-id': prefix('__detailed-architecture'),
            'relationship-type': { 'composed-of': { container: parent, nodes: childNodes.map((node) => prefix(node['unique-id'])) } },
        });
        for (const relationship of child.relationships ?? []) {
            relationships.push(prefixRelationship(relationship, prefix));
        }
    }
    return { ...architecture, nodes, relationships };
}

function prefixRelationship(relationship: Relationship, prefix: (id: string) => string): Relationship {
    const type = relationship['relationship-type'];
    const group = (g?: { container: string; nodes: string[] }) => g && { container: prefix(g.container), nodes: g.nodes.map(prefix) };
    return {
        ...relationship,
        'unique-id': prefix(relationship['unique-id']),
        'relationship-type': {
            connects: type.connects && {
                source: { ...type.connects.source, node: prefix(type.connects.source.node) },
                destination: { ...type.connects.destination, node: prefix(type.connects.destination.node) },
            },
            interacts: type.interacts && { actor: prefix(type.interacts.actor), nodes: type.interacts.nodes.map(prefix) },
            'composed-of': group(type['composed-of']),
            'deployed-in': group(type['deployed-in']),
        },
    };
}
