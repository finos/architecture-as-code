import React from 'react';
import type { CalmFlow } from '../../../core/types';
import { useCanvasStore } from '../../stores/canvas-store';
import { FlowListSurface, FlowTransitionSurface } from './FlowPropertiesSurface';
import type { CanvasFeatureRuntime } from '../types';

export function FlowPropertiesFeatureSurface({ runtime }: { runtime: CanvasFeatureRuntime }) {
    const flows = useCanvasStore((state) => state.flows);
    const activeFlowId = useCanvasStore((state) => state.activeFlowId);
    const flowHighlightEnabled = useCanvasStore((state) => state.flowHighlightEnabled);

    if (runtime.selectedEdge && !runtime.selectedNode) {
        return (
            <FlowTransitionSurface
                relationshipId={(runtime.selectedEdge.data as Record<string, unknown>)?.calmRelId as string ?? runtime.selectedEdge.id}
                reverseRelationshipId={(runtime.selectedEdge.data as Record<string, unknown>)?.calmReverseRelId as string | undefined}
                flows={flows}
                onFlowUpdate={(flowId, updates) => {
                    useCanvasStore.getState().updateFlow(flowId, updates);
                    setTimeout(() => runtime.emitChange(true), 0);
                }}
                readonly={runtime.readonlyMode}
            />
        );
    }
    if (runtime.selectedNode || runtime.selectedEdge) return null;

    // Build transitions from the retained canvas refs, including while sequence view unmounts ReactFlow.
    const createFlowFromAll = () => {
        if (runtime.readonlyMode) return;
        const transitions: CalmFlow['transitions'] = [];
        let sequence = 1;
        for (const edge of runtime.getCurrentEdges()) {
            const data = (edge.data ?? {}) as Record<string, unknown>;
            if (data.calmVariant === 'deployed-in' || data.calmVariant === 'composed-of') continue;
            const relationshipId = (data.calmRelId as string) ?? edge.id;
            const description = (data.description as string) ?? '';
            transitions.push({ 'relationship-unique-id': relationshipId, 'sequence-number': sequence++, description });
            if (data.direction === 'bidirectional' && data.calmReverseRelId) {
                transitions.push({
                    'relationship-unique-id': relationshipId,
                    'sequence-number': sequence++,
                    description,
                    direction: 'destination-to-source',
                });
            }
        }
        if (transitions.length === 0) transitions.push({ 'relationship-unique-id': '', 'sequence-number': 1, description: '' });
        useCanvasStore.getState().addFlow({
            'unique-id': `flow-${Date.now()}`,
            name: 'New Flow',
            description: '',
            transitions,
        });
        setTimeout(() => runtime.emitChange(true), 0);
    };

    return (
        <FlowListSurface
            flows={flows}
            activeFlowId={activeFlowId}
            flowHighlightEnabled={flowHighlightEnabled}
            onFlowAdd={(flow) => { useCanvasStore.getState().addFlow(flow); setTimeout(() => runtime.emitChange(true), 0); }}
            onFlowUpdate={(id, updates) => { useCanvasStore.getState().updateFlow(id, updates); setTimeout(() => runtime.emitChange(true), 0); }}
            onFlowDelete={(id) => { useCanvasStore.getState().removeFlow(id); setTimeout(() => runtime.emitChange(true), 0); }}
            onSetActiveFlow={(id) => useCanvasStore.getState().setActiveFlowId(id)}
            onToggleHighlight={(enabled) => useCanvasStore.getState().setFlowHighlightEnabled(enabled)}
            onCreateFlowFromAll={createFlowFromAll}
            readonly={runtime.readonlyMode}
        />
    );
}