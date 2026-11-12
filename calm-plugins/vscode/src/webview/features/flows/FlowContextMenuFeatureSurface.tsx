import React from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { FlowContextMenuSurface } from './FlowPropertiesSurface';
import type { CanvasFeatureRuntime } from '../types';

export function FlowContextMenuFeatureSurface({ runtime }: { runtime: CanvasFeatureRuntime }) {
    const flows = useCanvasStore((state) => state.flows);
    const menu = runtime.contextMenu;
    if (!menu) return null;

    const data = (menu.edge.data ?? {}) as Record<string, unknown>;
    const relationshipId = (data.calmRelId as string) ?? menu.edge.id;
    const reverseRelationshipId = data.calmReverseRelId as string | undefined;
    const addToFlow = (flowId: string, id: string) => {
        const flow = useCanvasStore.getState().flows.find((item) => item['unique-id'] === flowId);
        if (!flow) return;
        const sequence = Math.max(0, ...flow.transitions.map((transition) => transition['sequence-number'])) + 1;
        useCanvasStore.getState().updateFlow(flowId, {
            transitions: [...flow.transitions, { 'relationship-unique-id': id, 'sequence-number': sequence, description: '' }],
        });
        setTimeout(() => runtime.emitChange(true), 0);
    };

    // Remove one matching transition, preserving an editable placeholder if it was the last one.
    const removeFromFlow = (flowId: string, id: string, reverseId?: string) => {
        const flow = useCanvasStore.getState().flows.find((item) => item['unique-id'] === flowId);
        if (!flow) return;
        let removed = false;
        const transitions = flow.transitions.filter((transition) => {
            if (!removed && (transition['relationship-unique-id'] === id
                || (reverseId && transition['relationship-unique-id'] === reverseId))) {
                removed = true;
                return false;
            }
            return true;
        });
        useCanvasStore.getState().updateFlow(flowId, {
            transitions: transitions.length > 0 ? transitions : [{ 'relationship-unique-id': '', 'sequence-number': 1, description: '' }],
        });
        setTimeout(() => runtime.emitChange(true), 0);
    };

    return (
        <FlowContextMenuSurface
            position={{ x: menu.x, y: menu.y }}
            relationshipId={relationshipId}
            reverseRelationshipId={reverseRelationshipId}
            flows={flows}
            onAddToFlow={addToFlow}
            onRemoveFromFlow={removeFromFlow}
            onClose={() => runtime.setContextMenu(null)}
        />
    );
}