import { JSONPath } from 'jsonpath-plus';

export type CalmType = 'nodes' | 'relationships';

const ALTERNATIVE_KEYWORDS = ['oneOf', 'anyOf'];
const ID = 'properties.unique-id.const';
const INTERFACES = 'properties.interfaces.prefixItems[*]';

const ALTERNATIVES = `(?:${ALTERNATIVE_KEYWORDS.join('|')})`;
const CALM_TYPE = '(?:nodes|relationships)';
const DECLARATION = new RegExp(`^/properties/${CALM_TYPE}/(?:prefixItems/\\d+(?:/${ALTERNATIVES}/\\d+)?|items/${ALTERNATIVES}/\\d+)`);
const ENTRY_ALTERNATIVE = new RegExp(`^(/properties/${CALM_TYPE}/prefixItems/\\d+)/${ALTERNATIVES}/\\d+$`);

function fixedPath(calmType: CalmType): string {
    return `$.properties.${calmType}.prefixItems[*]`;
}

function choicePaths(calmType: CalmType): string[] {
    return [fixedPath(calmType), `$.properties.${calmType}.items`].flatMap(base =>
        ALTERNATIVE_KEYWORDS.map(keyword => `${base}.${keyword}[*]`));
}

/**
 * Shared so that the rules resolving declarations cannot disagree about where they are.
 */
export function declarationPaths(calmType: CalmType): string[] {
    return [fixedPath(calmType), ...choicePaths(calmType)];
}

export function fixedIdPath(calmType: CalmType): string {
    return `${fixedPath(calmType)}.${ID}`;
}

export function choiceIdPaths(calmType: CalmType): string[] {
    return choicePaths(calmType).map(path => `${path}.${ID}`);
}

export function declaredIdPaths(calmType: CalmType): string[] {
    return [fixedIdPath(calmType), ...choiceIdPaths(calmType)];
}

export function declaredInterfaceIdPaths(): string[] {
    return declarationPaths('nodes').map(path => `${path}.${INTERFACES}.${ID}`);
}

/**
 * Every site at which a pattern can declare both keywords, as Spectral `given` selectors.
 */
export function twoKeywordSites(): string[] {
    return (['nodes', 'relationships'] as CalmType[]).flatMap(calmType => [
        `$.properties.${calmType}.prefixItems[?(@.oneOf && @.anyOf)]`,
        `$.properties.${calmType}[?(@property === "items" && @.oneOf && @.anyOf)]`,
    ]);
}

export function declaredId(declaration: object): string | undefined {
    return JSONPath({ path: `$.${ID}`, json: declaration })[0];
}

// Reading a pointer back. A query run with `resultType: 'all'` returns each hit with the
// JSON Pointer it was found at, the only surviving trace of which site the hit came from.

/**
 * A pointer from outside these paths has no declaration, so it stands alone.
 */
export function containingDeclaration(pointer: string): string {
    return pointer.match(DECLARATION)?.[0] ?? pointer;
}

/**
 * Declarations sharing a group never appear in the same architecture. Only the
 * alternatives of one prefixItems entry qualify, because the entry is one position and one
 * of them wins. An items member competes with nothing, since items admits any number.
 */
export function exclusiveGroup(pointer: string): string {
    const declaration = containingDeclaration(pointer);
    return declaration.match(ENTRY_ALTERNATIVE)?.[1] ?? declaration;
}

/**
 * Sorts declarations into the order they fill the array: every prefixItems declaration
 * first, then every items declaration. Sorting the pointer text gets this backwards,
 * because "items" comes alphabetically before "prefixItems". Digits are padded so that
 * index 2 sorts before index 10.
 */
export function buildOrder(pointer: string): string {
    const site = containingDeclaration(pointer).includes('/items/') ? '1' : '0';
    return site + pointer.replace(/\d+/g, index => index.padStart(6, '0'));
}

export function isAlternative(pointer: string): boolean {
    return ENTRY_ALTERNATIVE.test(containingDeclaration(pointer));
}
