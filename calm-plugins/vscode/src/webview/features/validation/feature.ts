import type { CanvasFeatureDefinition } from '../types';
import { useCanvasStore } from '../../stores/canvas-store';
import { validateCanvas } from './validate-canvas';
import { ValidationFeatureSurface } from './ValidationFeatureSurface';

export const validationFeature: CanvasFeatureDefinition = {
    id: 'validation',
    toolbarActions: [
        {
            id: 'validate',
            label: 'Validate',
            group: 'validation',
            order: 10,
            execute: (runtime) => {
                // Validation reads the current canvas and writes results to shared state; it never owns document serialization.
                const store = useCanvasStore.getState();
                const { issues, nodes } = validateCanvas({
                    nodes: runtime.nodes,
                    edges: runtime.edges,
                    documentControls: store.documentControls,
                    flows: store.flows,
                    standardNodes: store.standardNodes as Array<{ id?: string; controls?: Record<string, unknown> }>,
                });
                store.setValidationIssues(issues);
                store.setShowValidation(true);
                runtime.setNodes(nodes);
            },
        },
    ],
    surfaces: { overlay: ValidationFeatureSurface },
};