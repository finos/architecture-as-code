import React, { useEffect, useState } from 'react';
import { useCanvasStore } from '../../stores/canvas-store';
import { flowToCalm } from '../../transforms/calm-editor-transformer';
import { notifyCanvasChanged } from '../../stores/sync-bridge';
import type { CanvasFeatureRuntime } from '../types';
import { PatternPicker } from '../../panels/PatternPicker';
import { openPatternPicker } from './commands';

export function PatternFeatureSurface({ runtime }: { runtime: CanvasFeatureRuntime }) {
    const [mode, setMode] = useState<'new' | 'apply' | null>(null);
    const patterns = useCanvasStore((state) => state.loadedPatterns);

    // Toolbar commands target this feature without making the core know about its picker state.
    useEffect(() => openPatternPicker.subscribe(setMode), []);

    const handleApply = (architecture: any, patternId?: string) => {
        if (mode === 'apply' && patternId) {
            // Merge only new IDs so applying a pattern does not overwrite existing architecture data.
            const current = flowToCalm(
                runtime.nodes,
                runtime.edges,
                useCanvasStore.getState().documentControls,
                useCanvasStore.getState().flows,
            ) as Record<string, unknown>;
            const incomingNodes = (architecture.nodes ?? []) as Array<Record<string, unknown>>;
            const incomingRelationships = (architecture.relationships ?? []) as Array<Record<string, unknown>>;
            const incomingFlows = (architecture.flows ?? []) as Array<Record<string, unknown>>;
            const currentNodes = (current.nodes as Array<Record<string, unknown>>) ?? [];
            const currentRelationships = (current.relationships as Array<Record<string, unknown>>) ?? [];
            const currentFlows = (current.flows as Array<Record<string, unknown>>) ?? [];
            const nodeIds = new Set(currentNodes.map((node) => node['unique-id']));
            const relationshipIds = new Set(currentRelationships.map((relationship) => relationship['unique-id']));
            const flowIds = new Set(currentFlows.map((flow) => flow['unique-id']));

            currentNodes.push(...incomingNodes.filter((node) => !nodeIds.has(node['unique-id'])));
            currentRelationships.push(...incomingRelationships.filter((relationship) => !relationshipIds.has(relationship['unique-id'])));
            currentFlows.push(...incomingFlows.filter((flow) => !flowIds.has(flow['unique-id'])));
            current.nodes = currentNodes;
            current.relationships = currentRelationships;
            current.flows = currentFlows;
            architecture = current;
        }

        if (patternId) {
            const metadata = (architecture.metadata ?? {}) as Record<string, unknown>;
            const appliedPatterns = (metadata.patterns as string[]) ?? [];
            if (!appliedPatterns.includes(patternId)) appliedPatterns.push(patternId);
            metadata.patterns = appliedPatterns;
            architecture.metadata = metadata;
        }

        const json = JSON.stringify(architecture, null, 2);
        runtime.loadArchitecture(json);
        notifyCanvasChanged(json);
        setMode(null);
    };

    return (
        <PatternPicker
            visible={mode !== null}
            mode={mode ?? 'new'}
            patterns={patterns as any[]}
            onApply={handleApply}
            onClose={() => setMode(null)}
        />
    );
}