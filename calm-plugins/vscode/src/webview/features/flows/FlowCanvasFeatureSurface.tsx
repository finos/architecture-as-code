import React, { useEffect, useMemo } from 'react';
import { getFlowPlaybackState } from '../../canvas/flow-playback';
import { FlowCanvasSurface } from './FlowCanvasSurface';
import { flowToCalm, type CalmArchitecture } from '../../transforms/calm-editor-transformer';
import { useCanvasStore } from '../../stores/canvas-store';
import type { CanvasFeatureRuntime } from '../types';
import { useFlowPlaybackStore } from './flow-state';

export function FlowCanvasFeatureSurface({ runtime, children }: { runtime: CanvasFeatureRuntime; children?: React.ReactNode }) {
    const flows = useCanvasStore((state) => state.flows);
    const activeFlowId = useCanvasStore((state) => state.activeFlowId);
    const canvasMode = useCanvasStore((state) => state.canvasMode);
    const documentControls = useCanvasStore((state) => state.documentControls);
    const step = useFlowPlaybackStore((state) => state.step);
    const playing = useFlowPlaybackStore((state) => state.playing);
    const speed = useFlowPlaybackStore((state) => state.speed);
    const setStep = useFlowPlaybackStore((state) => state.setStep);
    const setPlaying = useFlowPlaybackStore((state) => state.setPlaying);
    const setSpeed = useFlowPlaybackStore((state) => state.setSpeed);
    const resetPlayback = useFlowPlaybackStore((state) => state.reset);
    const activeFlow = flows.find((flow) => flow['unique-id'] === activeFlowId) ?? null;
    const { sequenceNumbers } = useMemo(
        () => getFlowPlaybackState(activeFlow?.transitions ?? [], step),
        [activeFlow, step],
    );
    const stepLabel = useMemo(() => {
        if (!activeFlow || step === 0) return '';
        const sequence = sequenceNumbers[step - 1];
        if (sequence === undefined) return '';
        const descriptions = (activeFlow.transitions ?? [])
            .filter((transition) => transition['sequence-number'] === sequence)
            .map((transition) => transition.description)
            .filter(Boolean);
        return descriptions.length > 0 ? `${sequence}. ${descriptions[0]}` : `Step ${sequence}`;
    }, [activeFlow, step, sequenceNumbers]);

    // A flow selection change starts a fresh playback session.
    useEffect(() => {
        resetPlayback();
    }, [activeFlowId, resetPlayback]);

    useEffect(() => {
        if (!playing || sequenceNumbers.length === 0) return;
        const timer = setInterval(() => {
            setStep((current) => {
                if (current >= sequenceNumbers.length) {
                    setPlaying(false);
                    return 0;
                }
                return current + 1;
            });
        }, 1500 / speed);
        return () => clearInterval(timer);
    }, [playing, sequenceNumbers.length, setPlaying, setStep, speed]);

    // The sequence view needs serialized architecture, while ReactFlow remains mounted in core.
    const architecture = useMemo(
        () => flowToCalm(runtime.nodes, runtime.edges, documentControls, flows) as CalmArchitecture,
        [documentControls, flows, runtime.edges, runtime.nodes],
    );

    const handlePlayPause = () => {
        if (!activeFlow || sequenceNumbers.length === 0) return;
        if (playing) {
            setPlaying(false);
            return;
        }
        if (step === 0 || step >= sequenceNumbers.length) setStep(1);
        setPlaying(true);
    };

    return (
        <FlowCanvasSurface
            enabled
            flows={flows}
            activeFlowId={activeFlowId}
            canvasMode={canvasMode}
            architecture={architecture}
            currentStep={step}
            totalSteps={sequenceNumbers.length}
            isPlaying={playing}
            playbackSpeed={speed}
            stepLabel={stepLabel}
            onFlowSelect={(id) => useCanvasStore.getState().setActiveFlowId(id)}
            onStepChange={setStep}
            onPlayPause={handlePlayPause}
            onStop={() => { setPlaying(false); setStep(0); }}
            onSpeedChange={setSpeed}
        >
            {children}
        </FlowCanvasSurface>
    );
}