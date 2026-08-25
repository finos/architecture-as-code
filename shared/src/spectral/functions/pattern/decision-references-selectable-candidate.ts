import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
import { listDeclaredCandidates, listSelectableCandidates, type SchemaNode } from '@finos/calm-models/pattern';

/**
 * Reports a candidate that a decision names, but that selection cannot reach.
 *
 * An id that does not exist at all is already an error from
 * `group-relationship-with-const-nodes-references-existing-nodes-in-pattern`. This rule
 * covers only the declared-but-unreachable case, so a typo is not reported twice.
 */
export function decisionReferencesSelectableCandidate(
    input: unknown,
    { calmType }: { calmType: 'nodes' | 'relationships' },
    context: RulesetFunctionContext
): IFunctionResult[] {
    if (!input || typeof input !== 'string') {
        return [];
    }

    const pattern = context.document.data as SchemaNode;

    const selectable = listSelectableCandidates(pattern, calmType).some((c) => c.uniqueId === input);
    if (selectable) {
        return [];
    }

    // Undeclared ids belong to the other rule.
    const declared = listDeclaredCandidates(pattern, calmType).some((c) => c.uniqueId === input);
    if (!declared) {
        return [];
    }

    return [{
        message:
            `'${input}' is declared but cannot be selected: its block declares both 'oneOf' and ` +
            '\'anyOf\', and only the \'oneOf\' candidates are resolved. Declare one keyword per ' +
            'block so every candidate a decision references can be chosen.',
        path: [...context.path],
    }];
}
