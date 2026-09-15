import { JSONPath } from 'jsonpath-plus';
import { groupBy, partition } from 'lodash';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
import { detectDuplicates, JSONPathMatch } from '../helper-functions';
import { byBuildOrder, containingDeclaration, containingEntry, declaredIdPaths, declaredInterfaceIdPaths, isAlternative } from './declaration-paths';

/**
 * The rule blames the second declaration it sees, but one query per declaration site means
 * matches arrive grouped by site rather than by position.
 */
function inBuildOrder(matches: JSONPathMatch[]): JSONPathMatch[] {
    return [...matches].sort((left, right) => byBuildOrder(left.pointer, right.pointer));
}

function groupMatches(matches: JSONPathMatch[], key: (pointer: string) => string): JSONPathMatch[][] {
    return Object.values(groupBy(matches, match => key(match.pointer)));
}

/**
 * A relationship names an interface beside its node, so an interface id only has to be
 * unique among the nodes that can appear in one architecture. At most one alternative of a
 * prefixItems entry is ever chosen, so alternatives may repeat an interface id.
 */
function detectDuplicateInterfaceIds(matches: JSONPathMatch[], seenIds: Set<unknown>, messages: IFunctionResult[]) {
    for (const entry of groupMatches(matches, containingEntry)) {
        const [choices, fixed] = partition(entry, match => isAlternative(match.pointer));

        detectDuplicates(fixed, seenIds, messages);
        groupMatches(choices, containingDeclaration).forEach(choice => detectDuplicates(choice, new Set(seenIds), messages));
        choices.forEach(match => seenIds.add(match.value));
    }
}

/**
 * Reports any unique-id a pattern declares more than once.
 */
export default (input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] => {
    if (!input) {
        return [];
    }
    const collect = (paths: string[]): JSONPathMatch[] => inBuildOrder(paths.flatMap(path =>
        JSONPath({ path, json: context.document.data as object, resultType: 'all' })));

    const nodeIdMatches = collect(declaredIdPaths('nodes'));
    const relationshipIdMatches = collect(declaredIdPaths('relationships'));
    const interfaceIdMatches = collect(declaredInterfaceIdPaths());

    const seenIds = new Set();

    const messages: IFunctionResult[] = [];

    detectDuplicates(nodeIdMatches, seenIds, messages);
    detectDuplicates(relationshipIdMatches, seenIds, messages);
    detectDuplicateInterfaceIds(interfaceIdMatches, seenIds, messages);

    return messages;
};
