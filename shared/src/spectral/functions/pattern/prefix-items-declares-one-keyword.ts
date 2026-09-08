import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';

const ENTRIES = [
    '$.properties.nodes.prefixItems[*]',
    '$.properties.relationships.prefixItems[*]',
];

interface Match {
    value: Record<string, unknown>;
    pointer: string;
}

/**
 * Spectral needs a segment array. A pointer string reports at the document root.
 */
function pointerToPath(pointer: string): string[] {
    return pointer.split('/').slice(1);
}

/**
 * Reports each `prefixItems` entry that declares both `oneOf` and `anyOf`.
 */
export function prefixItemsDeclaresOneKeyword(input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] {
    if (!input) {
        return [];
    }

    const matches: Match[] = ENTRIES.flatMap(path =>
        JSONPath({ path, json: context.document.data as object, resultType: 'all' }));

    return matches
        .filter(match => Array.isArray(match.value?.['oneOf']) && Array.isArray(match.value?.['anyOf']))
        .map(match => ({
            message: 'A prefixItems entry declares both \'oneOf\' and \'anyOf\'. An element must satisfy both, so some alternatives can never be selected. Declare one keyword.',
            path: pointerToPath(match.pointer),
        }));
}
