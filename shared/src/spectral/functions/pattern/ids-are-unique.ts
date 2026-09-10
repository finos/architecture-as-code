import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
import { detectDuplicates } from '../helper-functions';
import { declaredIdPaths, declaredInterfaceIdPaths } from './declaration-paths';

interface Match {
    value: unknown;
    pointer: string;
}

function declarationKey(pointer: string): string {
    return pointer.split('/properties/interfaces/')[0];
}

function entryKey(pointer: string): string {
    return declarationKey(pointer).split(/\/(?:oneOf|anyOf)\/\d+$/)[0];
}

function isAlternative(pointer: string): boolean {
    return declarationKey(pointer) !== entryKey(pointer);
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
    for (const entry of groupBy(matches, entryKey)) {
        const always = entry.filter(match => !isAlternative(match.pointer));
        const choices = groupBy(entry.filter(match => isAlternative(match.pointer)), declarationKey);

        detectDuplicates(always, seenIds, messages);
        choices.forEach(choice => detectDuplicates(choice, new Set(seenIds), messages));
        choices.flat().forEach(match => seenIds.add(match.value));
    }
}

/**
 * Reports any unique-id a pattern declares more than once.
 */
export default (input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] => {
    if (!input) {
        return [];
    }
    const collect = (paths: string[]): Match[] => paths.flatMap(path =>
        JSONPath({ path, json: context.document.data as object, resultType: 'all' }));

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