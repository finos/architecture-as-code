import type { CalmFlowTransitionSchema } from '@finos/calm-models/types';

/** Playback has not started: nothing is active and nothing has been visited. */
export const IDLE_STEP = -1;

export const STATUS_IDLE = 'Ready - press Play';
export const STATUS_COMPLETE = 'Flow complete';

/** The sequence number the given step highlights, or null when idle or completed. */
export function activeSequenceNumber(step: number, seqNumbers: number[]): number | null {
    return step >= 0 && step < seqNumbers.length ? seqNumbers[step] : null;
}

/** Every sequence number up to and including the current step. */
export function visitedSequenceNumbers(step: number, seqNumbers: number[]): Set<number> {
    if (step < 0) return new Set<number>();
    return new Set(seqNumbers.slice(0, Math.min(step + 1, seqNumbers.length)));
}

/** Status line below the playback bar. Parallel steps join into one line. */
export function describeStep(
    activeSeqNum: number | null,
    transitions: CalmFlowTransitionSchema[],
    isCompleted: boolean
): string {
    if (activeSeqNum == null) return isCompleted ? STATUS_COMPLETE : STATUS_IDLE;
    return transitions
        .filter((t) => t['sequence-number'] === activeSeqNum)
        .map((t) => t.description)
        .join(' · ');
}
