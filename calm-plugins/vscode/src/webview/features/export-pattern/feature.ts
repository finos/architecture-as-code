import type { CanvasFeatureDefinition } from '../types';
import { flowToCalm } from '../../transforms/calm-editor-transformer';
import { useCanvasStore } from '../../stores/canvas-store';

export const exportPatternFeature: CanvasFeatureDefinition = {
    id: 'export-pattern',
    menuActions: [
        {
            id: 'exportAsPattern',
            label: 'Export as Pattern',
            order: 40,
            visibleWhen: 'editable',
            execute: (runtime) => {
                const state = useCanvasStore.getState();
                const architecture = flowToCalm(runtime.nodes, runtime.edges, state.documentControls, state.flows);
                runtime.postMessage({ type: 'requestExportPattern', doc: JSON.stringify(architecture) });
            },
        },
    ],
};