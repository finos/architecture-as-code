import type { CanvasFeatureDefinition } from '../types';
import { useCanvasStore } from '../../stores/canvas-store';
import { transformFlowCanvas } from './transform-canvas';
import { FlowCanvasFeatureSurface } from './FlowCanvasFeatureSurface';
import { FlowPropertiesFeatureSurface } from './FlowPropertiesFeatureSurface';
import { FlowContextMenuFeatureSurface } from './FlowContextMenuFeatureSurface';
import { removeDeletedRelationships } from './flow-model';

export const flowFeature: CanvasFeatureDefinition = {
    id: 'flows',
    toolbarActions: [
        {
            id: 'toggleSequenceMode',
            label: () => useCanvasStore.getState().canvasMode === 'sequence' ? 'Architecture' : 'Sequence',
            title: () => useCanvasStore.getState().canvasMode === 'sequence'
                ? 'Switch to Architecture view'
                : useCanvasStore.getState().flows.length > 0
                    ? 'Switch to Sequence Diagram view'
                    : 'No flows defined — create one first',
            group: 'flows',
            order: 10,
            disabledWhen: () => useCanvasStore.getState().flows.length === 0,
            execute: () => {
                const store = useCanvasStore.getState();
                if (store.flows.length > 0) {
                    store.setCanvasMode(store.canvasMode === 'architecture' ? 'sequence' : 'architecture');
                }
            },
        },
    ],
    transformCanvas: transformFlowCanvas,
    onRelationshipsDeleted: (relationshipIds) => {
        const store = useCanvasStore.getState();
        for (const flow of removeDeletedRelationships(store.flows, relationshipIds)) {
            if (store.flows.find((current) => current['unique-id'] === flow['unique-id']) !== flow) {
                store.updateFlow(flow['unique-id'], { transitions: flow.transitions });
            }
        }
    },
    surfaces: {
        canvas: FlowCanvasFeatureSurface,
        properties: FlowPropertiesFeatureSurface,
        'context-menu': FlowContextMenuFeatureSurface,
    },
};