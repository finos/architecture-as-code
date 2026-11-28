import React, { useMemo } from 'react';
import { ControlCreator } from '../../panels/ControlCreator';
import { ControlPicker } from '../../panels/ControlPicker';
import { StandardNodeCreator } from '../../panels/StandardNodeCreator';
import { useCanvasStore } from '../../stores/canvas-store';
import { notifySaveStandardNode } from '../../stores/sync-bridge';
import { buildControlEntry, getRequirementUrl, type ControlEntry } from '../../panels/control-metadata';
import { makeControlMapKey, parseControlCurie } from '../../../extension/services/control-curie';
import type { ParsedRequirement } from '../../../extension/services/requirement-parser';
import type { CanvasFeatureRuntime } from '../types';
import { useStandardsControlsUi } from './state';

export function StandardsControlsModalSurface({ runtime }: { runtime: CanvasFeatureRuntime }) {
    const showStandardNodeCreator = useStandardsControlsUi((state) => state.showStandardNodeCreator);
    const showControlCreator = useStandardsControlsUi((state) => state.showControlCreator);
    const showControlPicker = useStandardsControlsUi((state) => state.showControlPicker);
    const target = useStandardsControlsUi((state) => state.controlPickerTarget);
    const closeControlPicker = useStandardsControlsUi((state) => state.closeControlPicker);
    const documentControls = useCanvasStore((state) => state.documentControls);

    // Deduplicate by both stored key and canonical requirement URL/curie.
    const existingControlKeys = useMemo(() => {
        if (!target) return new Set<string>();
        let controls: Record<string, unknown> | undefined;
        if (target.type === 'node') {
            const node = runtime.nodes.find((item) => item.id === target.nodeId);
            controls = (node?.data as Record<string, unknown>)?.controls as Record<string, unknown> | undefined;
        } else if (target.type === 'document') {
            controls = documentControls as Record<string, unknown> | undefined;
        } else {
            return target.existingKeys ?? new Set<string>();
        }
        const keys = new Set(Object.keys(controls ?? {}));
        for (const control of Object.values(controls ?? {})) {
            const requirements = (control as Record<string, unknown>)?.requirements as Array<Record<string, unknown>> | undefined;
            const url = requirements?.[0]?.['requirement-url'];
            if (typeof url === 'string') {
                keys.add(makeControlMapKey(url));
                const parsed = parseControlCurie(url);
                if (parsed) keys.add(parsed.controlName);
            }
        }
        return keys;
    }, [documentControls, runtime.nodes, target]);

    // Attach resolved controls to the selected node, document, or draft standard-node target.
    const handleControlAttach = (ref: string, parsed: ParsedRequirement) => {
        const key = makeControlMapKey(ref);
        const entry = buildControlEntry(ref, parsed);
        closeControlPicker();
        if (!target) return;

        if (target.type === 'node') {
            runtime.setNodes((nodes) => nodes.map((node) => {
                if (node.id !== target.nodeId) return node;
                const data = node.data as Record<string, unknown>;
                const existing = (data.controls as Record<string, ControlEntry>) ?? {};
                const previous = existing[key];
                if (previous && getRequirementUrl(previous) === getRequirementUrl(entry)) return node;
                return { ...node, data: { ...data, controls: { ...existing, [key]: entry } } };
            }));
            setTimeout(() => {
                runtime.emitChange(true);
                const node = runtime.getCurrentNodes().find((item) => item.id === target.nodeId);
                if (node) runtime.enrichNodeControls([node]);
            }, 0);
        } else if (target.type === 'document') {
            const existing = (useCanvasStore.getState().documentControls as Record<string, ControlEntry>) ?? {};
            const previous = existing[key];
            if (previous && getRequirementUrl(previous) === getRequirementUrl(entry)) return;
            useCanvasStore.setState({ documentControls: { ...existing, [key]: entry } });
            setTimeout(() => {
                runtime.emitChange(true);
                runtime.enrichAllControls();
            }, 0);
        } else {
            target.onAttach(ref, parsed);
        }
    };

    return (
        <>
            <StandardNodeCreator
                visible={showStandardNodeCreator}
                onClose={() => useStandardsControlsUi.getState().setShowStandardNodeCreator(false)}
                onSave={(json, fileName) => notifySaveStandardNode(fileName, json)}
                onRequestBrowseControls={(onAttach, existingKeys) => {
                    useStandardsControlsUi.getState().openControlPicker({ type: 'standard-node-draft', onAttach, existingKeys });
                }}
            />
            <ControlPicker
                visible={showControlPicker}
                onClose={closeControlPicker}
                onAttach={handleControlAttach}
                existingControlKeys={existingControlKeys}
            />
            <ControlCreator
                visible={showControlCreator}
                onClose={() => useStandardsControlsUi.getState().setShowControlCreator(false)}
            />
        </>
    );
}