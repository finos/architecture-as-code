import { get } from 'lodash';

export type CalmType = 'nodes' | 'relationships';

export const ALTERNATIVE_KEYWORDS = ['oneOf', 'anyOf'] as const;
const ID = 'properties.unique-id.const';
const OPTIONS = 'properties.relationship-type.properties.options';
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
    return get(declaration, ID);
}

/**
 * A relationship that carries options is a decision: it asks which alternatives to include.
 */
export function declaresOptions(relationship: object): boolean {
    return get(relationship, OPTIONS) !== undefined;
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

export function isAlternative(pointer: string): boolean {
    return ENTRY_ALTERNATIVE.test(containingDeclaration(pointer));
}

function declarationIndices(pointer: string): number[] {
    const declaration = containingDeclaration(pointer);
    const indices = (declaration.match(/\d+/g) ?? []).map(Number);
    return [declaration.includes('/items/') ? 1 : 0, ...indices];
}

/**
 * Orders declarations as an architecture fills the array: every prefixItems entry, then
 * every items member. The indices decide it, not the pointer text, which sorts "items"
 * ahead of "prefixItems" and an alternative ahead of the entry that holds it. A
 * declaration with fewer indices contains the other, so it comes first.
 */
export function byBuildOrder(left: string, right: string): number {
    const [first, second] = [left, right].map(declarationIndices);
    for (let depth = 0; depth < Math.max(first.length, second.length); depth++) {
        const difference = (first[depth] ?? -1) - (second[depth] ?? -1);
        if (difference !== 0) {
            return difference;
        }
    }
    return 0;
}
