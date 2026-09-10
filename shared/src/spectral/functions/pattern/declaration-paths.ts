import { JSONPath } from 'jsonpath-plus';

export type CalmType = 'nodes' | 'relationships';

const ALTERNATIVE_KEYWORDS = ['oneOf', 'anyOf'];
const ID = 'properties.unique-id.const';
const INTERFACES = 'properties.interfaces.prefixItems[*]';

const ALTERNATIVES = `(?:${ALTERNATIVE_KEYWORDS.join('|')})`;
const DECLARATION_POINTER = new RegExp(`^/properties/(?:nodes|relationships)/prefixItems/\\d+(?:/${ALTERNATIVES}/\\d+)?`);
const ALTERNATIVE_SUFFIX = new RegExp(`/${ALTERNATIVES}/\\d+$`);

function entryPath(calmType: CalmType): string {
    return `$.properties.${calmType}.prefixItems[*]`;
}

function alternativePaths(calmType: CalmType): string[] {
    return ALTERNATIVE_KEYWORDS.map(keyword => `${entryPath(calmType)}.${keyword}[*]`);
}

/**
 * Shared so that the rules resolving declarations cannot disagree about where they are.
 *
 * The paths below find declarations. A query run with `resultType: 'all'` returns each hit
 * with the JSON Pointer it was found at, and the `containing` helpers read that pointer
 * back, because it is the only surviving trace of which entry the hit came from.
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
    return declarationPaths('nodes').map(path => `${path}.${INTERFACES}.${ID}`);
}

export function declaredId(declaration: object): string | undefined {
    return JSONPath({ path: `$.${ID}`, json: declaration })[0];
}

/**
 * A pointer from outside these paths has no declaration, so it stands alone.
 */
export function containingDeclaration(pointer: string): string {
    return pointer.match(DECLARATION_POINTER)?.[0] ?? pointer;
}

export function containingEntry(pointer: string): string {
    return containingDeclaration(pointer).split(ALTERNATIVE_SUFFIX)[0];
}

export function isAlternative(pointer: string): boolean {
    return containingDeclaration(pointer) !== containingEntry(pointer);
}
