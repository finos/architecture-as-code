import type { CalmArchitecture } from '../transforms/calm-editor-transformer';

const UNKNOWN = 'unknown';

function findRelationship(relationshipId: string, arch: CalmArchitecture): Record<string, unknown> | undefined {
    return arch.relationships?.find((r) => r['unique-id'] === relationshipId);
}

function getRelationshipType(rel: Record<string, unknown>): Record<string, unknown> | undefined {
    return rel['relationship-type'] as Record<string, unknown> | undefined;
}

export function getSourceNodeId(relationshipId: string, arch: CalmArchitecture): string {
    const rel = findRelationship(relationshipId, arch);
    if (!rel) return UNKNOWN;
    const rt = getRelationshipType(rel);
    if (!rt) return UNKNOWN;

    const connects = rt.connects as { source?: { node?: string } } | undefined;
    if (connects) return connects.source?.node ?? UNKNOWN;

    const interacts = rt.interacts as { actor?: string } | undefined;
    if (interacts) return interacts.actor ?? UNKNOWN;

    const composedOf = rt['composed-of'] as { container?: string } | undefined;
    if (composedOf) return composedOf.container ?? UNKNOWN;

    const deployedIn = rt['deployed-in'] as { container?: string } | undefined;
    if (deployedIn) return deployedIn.container ?? UNKNOWN;

    return UNKNOWN;
}

export function getTargetNodeId(relationshipId: string, arch: CalmArchitecture): string {
    const rel = findRelationship(relationshipId, arch);
    if (!rel) return UNKNOWN;
    const rt = getRelationshipType(rel);
    if (!rt) return UNKNOWN;

    const connects = rt.connects as { destination?: { node?: string } } | undefined;
    if (connects) return connects.destination?.node ?? UNKNOWN;

    const interacts = rt.interacts as { nodes?: string[] } | undefined;
    if (interacts) return interacts.nodes?.[0] ?? UNKNOWN;

    const composedOf = rt['composed-of'] as { nodes?: string[] } | undefined;
    if (composedOf) return composedOf.nodes?.[0] ?? UNKNOWN;

    const deployedIn = rt['deployed-in'] as { nodes?: string[] } | undefined;
    if (deployedIn) return deployedIn.nodes?.[0] ?? UNKNOWN;

    return UNKNOWN;
}

export function getNodeName(nodeId: string, arch: CalmArchitecture): string {
    if (!nodeId || nodeId === UNKNOWN) return UNKNOWN;
    const node = arch.nodes?.find((n) => n['unique-id'] === nodeId);
    return (node?.name as string) ?? nodeId;
}

export function orientEndpoints<T>(source: T, target: T, isReturn: boolean): [T, T] {
    return isReturn ? [target, source] : [source, target];
}
