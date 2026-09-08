import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
import { detectDuplicates } from '../helper-functions';
import { declaredIdPaths, declaredInterfaceIdPaths } from './declaration-paths';

/**
 * Reports any unique-id a pattern declares more than once.
 */
export default (input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] => {
    if (!input) {
        return [];
    }
    const collect = (paths: string[]) => paths.flatMap(path =>
        JSONPath({ path, json: context.document.data as object, resultType: 'all' }));

    const nodeIdMatches = collect(declaredIdPaths('nodes'));
    const relationshipIdMatches = collect(declaredIdPaths('relationships'));
    const interfaceIdMatches = collect(declaredInterfaceIdPaths());

    const seenIds = new Set();

    const messages: IFunctionResult[] = [];

    detectDuplicates(nodeIdMatches, seenIds, messages);
    detectDuplicates(relationshipIdMatches, seenIds, messages);
    detectDuplicates(interfaceIdMatches, seenIds, messages);

    return messages;
};