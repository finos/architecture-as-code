import { IoPlayOutline, IoPauseOutline, IoPlaySkipForwardOutline, IoPlaySkipBackOutline, IoRefreshOutline, IoPlayForwardOutline } from 'react-icons/io5';
import type { FlowPlaybackState } from './useFlowPlayback.js';

interface PlaybackControlsProps {
    playback: FlowPlaybackState;
    totalSteps: number;
    statusText?: string;
}

const SPEEDS = [0.5, 1, 2];
const ICON_SIZE = 16;
const PLAY_ICON_SIZE = 18;

export function PlaybackControls({ playback, totalSteps, statusText }: PlaybackControlsProps) {
    const { step, playing, speed, setSpeed, togglePlay, stepFwd, stepBk, reset, showAll, stopPlaying, setStep } = playback;

    // One stop after the last step, so "Flow complete" has its own slider position.
    const maxSliderValue = totalSteps + 1;

    return (
        <div className="px-4 py-2 bg-base-100 border-t border-base-300 flex items-center gap-2">
            <button type="button" onClick={reset} className="btn btn-sm btn-ghost" title="Reset" aria-label="Reset">
                <IoRefreshOutline size={ICON_SIZE} />
            </button>
            <button type="button" onClick={stepBk} className="btn btn-sm btn-ghost" title="Step Back" aria-label="Step back">
                <IoPlaySkipBackOutline size={ICON_SIZE} />
            </button>
            <button type="button" onClick={togglePlay} className="btn btn-sm btn-primary" title={playing ? 'Pause' : 'Play'} aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? <IoPauseOutline size={PLAY_ICON_SIZE} /> : <IoPlayOutline size={PLAY_ICON_SIZE} />}
            </button>
            <button type="button" onClick={stepFwd} className="btn btn-sm btn-ghost" title="Step Forward" aria-label="Step forward">
                <IoPlaySkipForwardOutline size={ICON_SIZE} />
            </button>
            <button type="button" onClick={showAll} className="btn btn-sm btn-ghost" title="Show All" aria-label="Show all steps">
                <IoPlayForwardOutline size={ICON_SIZE} />
            </button>

            <div className="flex items-center gap-0.5 ml-1">
                {SPEEDS.map(s => (
                    <button key={s}
                        type="button"
                        className={`btn btn-xs ${speed === s ? 'btn-accent' : 'btn-ghost'}`}
                        title={`${s}× speed`}
                        aria-label={`${s} times speed`}
                        aria-pressed={speed === s}
                        onClick={() => setSpeed(s)}
                    >
                        {s}×
                    </button>
                ))}
            </div>

            <input
                type="range"
                min={0}
                max={maxSliderValue}
                value={Math.min(step + 1, maxSliderValue)}
                onChange={e => { stopPlaying(); setStep(parseInt(e.target.value, 10) - 1); }}
                className="range range-xs flex-1 mx-2"
                aria-label="Flow step"
            />
            <span className="text-xs text-base-content/60 min-w-45 truncate text-right">
                {Math.min(step + 1, totalSteps)} / {totalSteps}
                {statusText ? ` - ${statusText}` : ''}
            </span>
        </div>
    );
}
