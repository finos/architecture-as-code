import { JSONPath } from 'jsonpath-plus';

export type CalmType = 'nodes' | 'relationships';

/**
 * Shared so that the rules resolving declarations cannot disagree about where they are.
 */
export function declarationPaths(calmType: CalmType): string[] {
    const entry = `$.properties.${calmType}.prefixItems[*]`;
    return [entry, `${entry}.oneOf[*]`, `${entry}.anyOf[*]`];
}

export function declaredIdPaths(calmType: CalmType): string[] {
    return declarationPaths(calmType).map(path => `${path}.properties.unique-id.const`);
}

export function declaredInterfaceIdPaths(): string[] {
    return declarationPaths('nodes').map(path => `${path}.properties.interfaces.prefixItems[*].properties.unique-id.const`);
}

export function declaredId(declaration: object): string | undefined {
    return JSONPath({ path: '$.properties.unique-id.const', json: declaration })[0];
}
