import { IFunctionResult } from '@stoplight/spectral-core';
import { TimelineInput } from './timeline-types';

/**
 * Checks that the moments array exists and is non-empty.
 */
export function momentsMustBeNonEmpty(input: TimelineInput | null | undefined, _?: unknown, _context?: unknown): IFunctionResult[] {
    if (!input) {
        return [];
    }

    const moments = input.moments;
    if (!Array.isArray(moments) || moments.length === 0) {
        return [{
            message: 'Timeline must define at least one moment.',
            path: ['moments']
        }];
    }

    return [];
}
