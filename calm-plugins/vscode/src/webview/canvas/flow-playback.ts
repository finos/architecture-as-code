import type { CalmTransition } from '../../core/types';

export type FlowEdgeDirection = 'forward' | 'reverse';

export function getFlowPlaybackState(transitions: readonly CalmTransition[], step: number) {
    const sequenceNumbers = [...new Set(transitions.map(t => t['sequence-number']))].sort((a, b) => a - b);
    const activeSequence = step > 0 ? sequenceNumbers[step - 1] ?? null : null;
    const visitedSequences = new Set(sequenceNumbers.slice(0, Math.max(0, step - 1)));
    return { sequenceNumbers, activeSequence, visitedSequences };
}

export function getFlowEdgeDirections(
    transitions: readonly CalmTransition[],
    activeSequence: number | null,
    relationshipId: string,
    reverseRelationshipId?: string,
): FlowEdgeDirection[] {
    const directions = new Set<FlowEdgeDirection>();
    for (const transition of transitions) {
        const id = transition['relationship-unique-id'];
        if (transition['sequence-number'] !== activeSequence
            || (id !== relationshipId && id !== reverseRelationshipId)) continue;
        const reverseRelationship = id === reverseRelationshipId;
        const reverseTransition = transition.direction === 'destination-to-source';
        directions.add(reverseRelationship !== reverseTransition ? 'reverse' : 'forward');
    }
    return [...directions];
}
