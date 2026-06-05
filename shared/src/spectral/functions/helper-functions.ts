import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';

interface JSONPathMatch {
    value: unknown;
    pointer: string;
}

export function detectDuplicates(matches: JSONPathMatch[], seenIds: Set<unknown>, messages: IFunctionResult[]) {
    for (const match of matches) {
        const id = match['value'];

        if (seenIds.has(id)) {
            messages.push({
                message: `Duplicate unique-id detected. ID: ${id}, path: ${match['pointer']}`,
                path: [match['pointer']]
            });
        }
        else {
            seenIds.add(id);
        }
    }
}

export function numericalPlaceHolder(input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] | void {
    if (input == -1) {
        return [{
            message: 'Value was equal to -1 - placeholder property detected',
            path: [...context.path]
        }];
    }
}