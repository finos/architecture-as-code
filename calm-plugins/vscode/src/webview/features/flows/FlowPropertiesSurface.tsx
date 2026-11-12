import React from 'react';
import type { CalmFlow } from '../../../core/types';
import { FlowList } from '../../panels/FlowList';
import { FlowTransitionEditor } from '../../panels/FlowTransitionEditor';
import { FlowContextMenu } from '../../canvas/FlowContextMenu';

export function FlowListSurface(props: React.ComponentProps<typeof FlowList>) {
    return <FlowList {...props} />;
}

export function FlowTransitionSurface(props: React.ComponentProps<typeof FlowTransitionEditor>) {
    return <FlowTransitionEditor {...props} />;
}

interface FlowContextMenuSurfaceProps {
    position: { x: number; y: number };
    relationshipId: string;
    reverseRelationshipId?: string;
    flows: CalmFlow[];
    onAddToFlow: (flowId: string, relationshipId: string) => void;
    onRemoveFromFlow: (flowId: string, relationshipId: string, reverseRelationshipId?: string) => void;
    onClose: () => void;
}

export function FlowContextMenuSurface({
    position,
    relationshipId,
    reverseRelationshipId,
    flows,
    onAddToFlow,
    onRemoveFromFlow,
    onClose,
}: FlowContextMenuSurfaceProps) {
    const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    const badges = flows.map((flow, index) => {
        const metadata = (flow.metadata as Record<string, unknown>) ?? {};
        const style = (metadata['flow-style'] as { background?: string }) ?? {};
        return { flowId: flow['unique-id'], name: flow.name || flow['unique-id'], color: style.background ?? defaultColors[index % defaultColors.length] };
    });
    const memberIds = new Set<string>();
    for (const flow of flows) {
        for (const transition of flow.transitions ?? []) {
            if (transition['relationship-unique-id'] === relationshipId
                || (reverseRelationshipId && transition['relationship-unique-id'] === reverseRelationshipId)) {
                memberIds.add(flow['unique-id']);
            }
        }
    }

    return (
        <FlowContextMenu
            x={position.x}
            y={position.y}
            relationshipId={relationshipId}
            reverseRelationshipId={reverseRelationshipId}
            memberFlows={badges.filter((badge) => memberIds.has(badge.flowId))}
            availableFlows={badges.filter((badge) => !memberIds.has(badge.flowId))}
            onAddToFlow={onAddToFlow}
            onRemoveFromFlow={onRemoveFromFlow}
            onClose={onClose}
        />
    );
}