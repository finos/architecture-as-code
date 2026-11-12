import type { CalmFlow } from '../../../core/types';

export function removeDeletedRelationships(flows: CalmFlow[], deletedIds: ReadonlySet<string>): CalmFlow[] {
    return flows.map((flow) => {
        const currentTransitions = flow.transitions ?? [];
        const transitions = currentTransitions.filter(
            (transition) => !deletedIds.has(transition['relationship-unique-id']),
        );
        if (transitions.length === currentTransitions.length) return flow;
        // Keep the flow editable after its last relationship is deleted.
        return {
            ...flow,
            transitions: transitions.length > 0
                ? transitions
                : [{ 'relationship-unique-id': '', 'sequence-number': 1, description: '' }],
        };
    });
}