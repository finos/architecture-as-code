import React from 'react';
import type { CalmFlow } from '../../../core/types';
import type { CalmArchitecture } from '../../transforms/calm-editor-transformer';
import { FlowPlaybackBar } from '../../canvas/FlowPlaybackBar';
import { FlowSequenceView } from '../../canvas/FlowSequenceView';

type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

interface FlowCanvasSurfaceProps {
    enabled: boolean;
    flows: CalmFlow[];
    activeFlowId: string | null;
    canvasMode: 'architecture' | 'sequence';
    architecture: CalmArchitecture;
    currentStep: number;
    totalSteps: number;
    isPlaying: boolean;
    playbackSpeed: PlaybackSpeed;
    stepLabel: string;
    onFlowSelect: (id: string | null) => void;
    onStepChange: (step: number) => void;
    onPlayPause: () => void;
    onStop: () => void;
    onSpeedChange: (speed: PlaybackSpeed) => void;
    children: React.ReactNode;
}

export function FlowCanvasSurface({
    enabled,
    flows,
    activeFlowId,
    canvasMode,
    architecture,
    currentStep,
    totalSteps,
    isPlaying,
    playbackSpeed,
    stepLabel,
    onFlowSelect,
    onStepChange,
    onPlayPause,
    onStop,
    onSpeedChange,
    children,
}: FlowCanvasSurfaceProps) {
    return (
        <>
            {enabled && flows.length > 0 && (
                <FlowPlaybackBar
                    flows={flows}
                    activeFlowId={activeFlowId}
                    onFlowSelect={onFlowSelect}
                    showPlayback
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    isPlaying={isPlaying}
                    onStepChange={onStepChange}
                    onPlayPause={onPlayPause}
                    onStop={onStop}
                    playbackSpeed={playbackSpeed}
                    onSpeedChange={onSpeedChange}
                    stepLabel={stepLabel}
                />
            )}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                {enabled && canvasMode === 'sequence' ? (
                    <FlowSequenceView
                        flows={flows}
                        architecture={architecture}
                        activeFlowId={activeFlowId}
                        onFlowSelect={(id) => onFlowSelect(id)}
                        currentStep={currentStep}
                    />
                ) : children}
            </div>
        </>
    );
}