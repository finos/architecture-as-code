import React from 'react';
import type { CalmFlow } from '../../core/types';

type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;
const SPEED_OPTIONS: { value: PlaybackSpeed; label: string }[] = [
    { value: 0.5, label: '0.5×' },
    { value: 1, label: '1×' },
    { value: 1.5, label: '1.5×' },
    { value: 2, label: '2×' },
];

interface FlowPlaybackBarProps {
    flows: CalmFlow[];
    activeFlowId: string | null;
    onFlowSelect: (id: string | null) => void;
    showPlayback?: boolean;
    currentStep?: number;
    totalSteps?: number;
    isPlaying?: boolean;
    playbackSpeed?: PlaybackSpeed;
    onStepChange?: (step: number) => void;
    onPlayPause?: () => void;
    onStop?: () => void;
    onSpeedChange?: (speed: PlaybackSpeed) => void;
    stepLabel?: string;
    flowColor?: string;
}

function getFlowStyleColor(flow: CalmFlow): string | undefined {
    const meta = flow.metadata as Record<string, unknown> | undefined;
    const style = (meta?.['flow-style']) as { background?: string } | undefined;
    return style?.background;
}

export function FlowPlaybackBar({
    flows,
    activeFlowId,
    onFlowSelect,
    showPlayback = false,
    currentStep = 0,
    totalSteps = 0,
    isPlaying = false,
    playbackSpeed = 1,
    onStepChange,
    onPlayPause,
    onStop,
    onSpeedChange,
    stepLabel = '',
    flowColor,
}: FlowPlaybackBarProps) {
    if (flows.length === 0) return null;

    const isActive = activeFlowId !== null;
    const matchedFlow = isActive ? flows.find(f => f['unique-id'] === activeFlowId) : undefined;
    const canPlay = !!matchedFlow && totalSteps > 0;
    const hasPrev = canPlay && currentStep > 0;
    const hasNext = canPlay && currentStep < totalSteps;
    const activeColor = flowColor ?? (matchedFlow ? getFlowStyleColor(matchedFlow) : undefined) ?? '#60a5fa';

    return (
        <div style={barStyle}>
            <label style={labelStyle}>Flow</label>
            <select
                value={activeFlowId ?? ''}
                onChange={(e) => onFlowSelect(e.target.value || null)}
                style={selectStyle}
            >
                <option value="">No Flow</option>
                {flows.length > 1 && <option value="__all__">All Flows</option>}
                {flows.map((f) => (
                    <option key={f['unique-id']} value={f['unique-id']}>
                        {f.name || f['unique-id']}
                    </option>
                ))}
            </select>

            {showPlayback && onStepChange && onPlayPause && onStop && (
                <>
                    <span style={sepStyle} />
                    <button type="button" onClick={onStop} style={controlBtn} title="Stop and clear" disabled={!canPlay}>
                        ■
                    </button>
                    <button type="button" onClick={() => hasPrev && onStepChange(currentStep - 1)} style={{ ...controlBtn, opacity: hasPrev ? 1 : 0.3 }} title="Previous step" disabled={!hasPrev}>
                        ◀
                    </button>
                    <button type="button" onClick={onPlayPause} style={{ ...controlBtn, color: isPlaying ? '#f59e0b' : '#10b981', opacity: canPlay ? 1 : 0.3 }} title={isPlaying ? 'Pause' : 'Play'} disabled={!canPlay}>
                        {isPlaying ? '⏸' : '▶'}
                    </button>
                    <button type="button" onClick={() => hasNext && onStepChange(currentStep + 1)} style={{ ...controlBtn, opacity: hasNext ? 1 : 0.3 }} title="Next step" disabled={!hasNext}>
                        ▶
                    </button>
                    <span style={{ ...stepLabelStyle, maxWidth: '400px' }} title={stepLabel}>
                        {currentStep === 0 ? (
                            <span style={{ color: 'var(--calm-fg-muted)' }}>Idle</span>
                        ) : (
                            <>
                                <span style={{ color: activeColor, fontWeight: 700 }}>{stepLabel.split('. ')[0]}.</span>
                                <span style={{ marginLeft: '4px' }}>{stepLabel.split('. ').slice(1).join('. ')}</span>
                            </>
                        )}
                        {totalSteps > 0 && <span style={{ color: 'var(--calm-fg-muted)', marginLeft: '6px', flexShrink: 0 }}>({currentStep}/{totalSteps})</span>}
                    </span>
                    {onSpeedChange && (
                        <select
                            value={playbackSpeed}
                            onChange={(e) => onSpeedChange(parseFloat(e.target.value) as PlaybackSpeed)}
                            style={speedSelectStyle}
                            title="Playback speed"
                            disabled={!canPlay}
                        >
                            {SPEED_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    )}
                </>
            )}
        </div>
    );
}

const barStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderBottom: '1px solid var(--calm-border)',
    background: 'var(--calm-bg)',
    flexShrink: 0,
    overflow: 'hidden',
};
const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--calm-fg-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
};
const selectStyle: React.CSSProperties = {
    maxWidth: '200px',
    padding: '3px 6px',
    fontSize: '11px',
    color: 'var(--calm-fg)',
    background: 'var(--calm-bg-input)',
    border: '1px solid var(--calm-border-input)',
    borderRadius: '3px',
    outline: 'none',
};
const sepStyle: React.CSSProperties = {
    width: '1px',
    height: '16px',
    background: 'var(--calm-border)',
    margin: '0 2px',
};
const controlBtn: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--calm-fg)',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '2px 4px',
    lineHeight: 1,
};
const speedSelectStyle: React.CSSProperties = {
    padding: '2px 4px',
    fontSize: '10px',
    color: 'var(--calm-fg)',
    background: 'var(--calm-bg-input)',
    border: '1px solid var(--calm-border-input)',
    borderRadius: '3px',
    outline: 'none',
    cursor: 'pointer',
    flexShrink: 0,
};
const stepLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--calm-fg)',
    marginLeft: '4px',
    flex: '0 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};
