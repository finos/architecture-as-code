import { JSONPath } from 'jsonpath-plus';

export type CalmType = 'nodes' | 'relationships';

const ID = 'properties.unique-id.const';

function entryPath(calmType: CalmType): string {
    return `$.properties.${calmType}.prefixItems[*]`;
}

function alternativePaths(calmType: CalmType): string[] {
    return ['oneOf', 'anyOf'].map(keyword => `${entryPath(calmType)}.${keyword}[*]`);
}

/**
 * Shared so that the rules resolving declarations cannot disagree about where they are.
 */
export function declarationPaths(calmType: CalmType): string[] {
    return [entryPath(calmType), ...alternativePaths(calmType)];
}

export function fixedIdPath(calmType: CalmType): string {
    return `${entryPath(calmType)}.${ID}`;
}

export function alternativeIdPaths(calmType: CalmType): string[] {
    return alternativePaths(calmType).map(path => `${path}.${ID}`);
}

export function declaredIdPaths(calmType: CalmType): string[] {
    return [fixedIdPath(calmType), ...alternativeIdPaths(calmType)];
}

export function declaredInterfaceIdPaths(): string[] {
    return declarationPaths('nodes').map(path => `${path}.properties.interfaces.prefixItems[*].${ID}`);
}

export function declaredId(declaration: object): string | undefined {
    return JSONPath({ path: '$.properties.unique-id.const', json: declaration })[0];
}
