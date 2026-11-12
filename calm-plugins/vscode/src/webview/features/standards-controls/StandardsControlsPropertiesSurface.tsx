import React from 'react';
import { ControlsList } from '../../panels/ControlsList';
import type { CanvasFeatureRuntime } from '../types';
import { useCanvasStore } from '../../stores/canvas-store';
import { useStandardsControlsUi } from './state';

export function StandardsControlsPropertiesSurface({ runtime }: { runtime: CanvasFeatureRuntime }) {
    const documentControls = useCanvasStore((state) => state.documentControls);
    const selectedNode = runtime.selectedNode;
    const selectedEdge = runtime.selectedEdge;

    if (selectedNode) {
        const data = selectedNode.data as Record<string, unknown>;
        return (
            <ControlsList
                controls={data.controls as any}
                onUpdate={(controls) => runtime.updateNode(selectedNode.id, 'controls', controls)}
                readonly={runtime.readonlyMode}
                expandControl={runtime.expandControlKey}
                onBrowseControls={() => useStandardsControlsUi.getState().openControlPicker({ type: 'node', nodeId: selectedNode.id })}
            />
        );
    }

    if (selectedEdge) return null;

    return (
        <>
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--calm-fg-muted)', marginBottom: '8px' }}>
                Solution Controls
            </div>
            <ControlsList
                controls={documentControls as any}
                onUpdate={(controls) => {
                    useCanvasStore.setState({ documentControls: controls });
                    runtime.emitChange(true);
                }}
                readonly={runtime.readonlyMode}
                expandControl={runtime.expandControlKey}
                onBrowseControls={() => useStandardsControlsUi.getState().openControlPicker({ type: 'document' })}
            />
            {(!documentControls || Object.keys(documentControls).length === 0) && (
                <p style={{ fontSize: '11px', color: 'var(--calm-fg-muted)', textAlign: 'center', padding: '20px 0' }}>
                    No solution-level controls. Select a node or drop a standard here.
                </p>
            )}
        </>
    );
}