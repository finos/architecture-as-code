import { JSONPath } from 'jsonpath-plus';
import { partition } from 'lodash';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
import { detectDuplicates } from '../helper-functions';
import { buildOrder, containingDeclaration, declaredIdPaths, declaredInterfaceIdPaths, exclusiveGroup, isAlternative } from './declaration-paths';

interface Match {
    value: unknown;
    pointer: string;
}

/**
 * detectDuplicates blames the second match it sees, so the later declaration must come
 * second. One query per declaration site means matches arrive grouped by site instead.
 */
function inBuildOrder(matches: Match[]): Match[] {
    return [...matches].sort((left, right) => buildOrder(left.pointer) < buildOrder(right.pointer) ? -1 : 1);
}

function groupBy(matches: Match[], key: (pointer: string) => string): Match[][] {
    const groups = new Map<string, Match[]>();
    for (const match of matches) {
        const groupKey = key(match.pointer);
        const group = groups.get(groupKey) ?? [];
        group.push(match);
        groups.set(groupKey, group);
    }
    return [...groups.values()];
}

/**
 * A relationship names an interface beside its node, so an interface id only has to be
 * unique among the nodes that can appear in one architecture. At most one alternative of a
 * prefixItems entry is ever chosen, so alternatives may repeat an interface id.
 */
function detectDuplicateInterfaceIds(matches: Match[], seenIds: Set<unknown>, messages: IFunctionResult[]) {
    for (const group of groupBy(matches, exclusiveGroup)) {
        const [choices, fixed] = partition(group, match => isAlternative(match.pointer));

        detectDuplicates(fixed, seenIds, messages);
        groupBy(choices, containingDeclaration).forEach(choice => detectDuplicates(choice, new Set(seenIds), messages));
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
    const collect = (paths: string[]): Match[] => inBuildOrder(paths.flatMap(path =>
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
