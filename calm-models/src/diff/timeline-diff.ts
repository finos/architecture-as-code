import type { CalmTimelineSchema, CalmMomentSchema } from '../types/index.js';
import { CalmTimeline } from '../model/timeline.js';
import { diffArchitectures } from './diff.js';
import type { DiffResult } from './diff-types.js';
import {
    resolveMomentArchitecture,
    type ArchitectureResolver,
} from './architecture-resolver.js';

/**
 * The diff between the resolved architectures of two moments, tagged with the
 * `unique-id` of each moment so consumers know which pair it describes.
 */
export interface MomentDiff {
    from: string;
    to: string;
    diff: DiffResult;
}

/** Either a parsed {@link CalmTimeline} or the raw timeline schema/JSON. */
export type TimelineInput = CalmTimeline | CalmTimelineSchema;

/**
 * Normalises the accepted timeline inputs to the raw schema so we can operate
 * on the portable JSON shape (matching the producer's document order) rather
 * than depending on whether a {@link CalmTimeline} was hydrated.
 */
function toTimelineSchema(timeline: TimelineInput): CalmTimelineSchema {
    if (timeline instanceof CalmTimeline) {
        return timeline.toSchema();
    }
    return timeline;
}

function getMoments(timeline: TimelineInput): CalmMomentSchema[] {
    return toTimelineSchema(timeline).moments ?? [];
}

/**
 * Diffs each consecutive pair of moments in a timeline (`moment[i]` vs
 * `moment[i+1]`), preserving the order the moments appear in the document.
 *
 * Returns an ordered array of {@link MomentDiff}; a timeline with fewer than
 * two moments yields an empty array (no adjacent pairs exist).
 */
export async function diffTimelineAdjacent(
    timeline: TimelineInput,
    resolver?: ArchitectureResolver,
): Promise<MomentDiff[]> {
    const moments = getMoments(timeline);
    const results: MomentDiff[] = [];

    for (let i = 0; i < moments.length - 1; i++) {
        const fromMoment = moments[i];
        const toMoment = moments[i + 1];
        const [archFrom, archTo] = await Promise.all([
            resolveMomentArchitecture(fromMoment, resolver),
            resolveMomentArchitecture(toMoment, resolver),
        ]);
        results.push({
            from: fromMoment['unique-id'],
            to: toMoment['unique-id'],
            diff: diffArchitectures(archFrom, archTo),
        });
    }

    return results;
}

/**
 * Diffs any two moments in a timeline by their `unique-id` (not restricted to
 * adjacent moments).
 *
 * Throws when either id is not present in the timeline.
 */
export async function diffTimelineMoments(
    timeline: TimelineInput,
    fromMomentId: string,
    toMomentId: string,
    resolver?: ArchitectureResolver,
): Promise<MomentDiff> {
    const moments = getMoments(timeline);
    const fromMoment = moments.find((m) => m['unique-id'] === fromMomentId);
    const toMoment = moments.find((m) => m['unique-id'] === toMomentId);

    if (!fromMoment) {
        throw new Error(`Moment '${fromMomentId}' was not found in the timeline.`);
    }
    if (!toMoment) {
        throw new Error(`Moment '${toMomentId}' was not found in the timeline.`);
    }

    const [archFrom, archTo] = await Promise.all([
        resolveMomentArchitecture(fromMoment, resolver),
        resolveMomentArchitecture(toMoment, resolver),
    ]);

    return {
        from: fromMomentId,
        to: toMomentId,
        diff: diffArchitectures(archFrom, archTo),
    };
}
