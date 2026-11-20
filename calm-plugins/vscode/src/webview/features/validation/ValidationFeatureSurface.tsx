import React from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { ValidationPanel } from './ValidationPanel';
import type { CanvasFeatureRuntime } from '../types';

export function ValidationFeatureSurface({ runtime }: { runtime: CanvasFeatureRuntime }) {
    const showValidation = useCanvasStore((state) => state.showValidation);
    const validationIssues = useCanvasStore((state) => state.validationIssues);
    const setShowValidation = useCanvasStore((state) => state.setShowValidation);

    if (!showValidation) return null;

    return (
        <ValidationPanel
            issues={validationIssues}
            onClose={() => setShowValidation(false)}
            onIssueClick={(issue) => {
                if (issue.nodeId) {
                    const node = runtime.nodes.find((item) => item.id === issue.nodeId);
                    if (node) {
                        runtime.setSelectedNode(node);
                        runtime.setSelectedEdge(null);
                        useCanvasStore.getState().selectNode(node.id);
                    }
                } else {
                    runtime.setSelectedNode(null);
                    runtime.setSelectedEdge(null);
                    useCanvasStore.getState().selectNode(null);
                }
                if (issue.controlId) runtime.setExpandControlKey(issue.controlId);
            }}
        />
    );
}