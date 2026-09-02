import { useState, useEffect, useCallback } from 'react';
import { IDLE_STEP } from './flow-step.js';

/** Interval at 1x speed. Both flow views use it, so the two tabs play at one pace. */
const DEFAULT_INTERVAL_MS = 1200;

export interface FlowPlaybackOptions {
    maxStep: number;
    /** Base interval in ms at 1× speed. */
    baseIntervalMs?: number;
}

export interface FlowPlaybackState {
    step: number;
    playing: boolean;
    speed: number;
    /** True when step has advanced past the last sequence number. */
    isCompleted: boolean;
    setStep: (s: number | ((prev: number) => number)) => void;
    setSpeed: (s: number) => void;
    togglePlay: () => void;
    stepFwd: () => void;
    stepBk: () => void;
    reset: () => void;
    showAll: () => void;
    stopPlaying: () => void;
}

/**
 * Manages play/pause/step/scrub/speed state for flow animation.
 *
 * `step` is an index into the array of distinct sequence numbers:
 *  - `IDLE_STEP`    -> idle. Nothing is highlighted.
 *  - `0..maxStep`   -> that sequence group is active.
 *  - `maxStep + 1`  -> completed. All steps are visited and none is active.
 */
export function useFlowPlayback(
    { maxStep, baseIntervalMs = DEFAULT_INTERVAL_MS }: FlowPlaybackOptions,
    resetDep?: unknown
): FlowPlaybackState {
    const [step, setStep] = useState(IDLE_STEP);
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);

    const stopPlaying = useCallback(() => setPlaying(false), []);

    // Reset when the upstream dependency changes, for example flowJson.
    useEffect(() => {
        setStep(IDLE_STEP);
        setPlaying(false);
    }, [resetDep]);

    // This effect runs again when `speed` changes, so a new speed applies during
    // playback and not only at the next play.
    useEffect(() => {
        if (!playing) return;
        const timer = setInterval(() => {
            setStep(prev => (prev > maxStep ? prev : prev + 1));
        }, baseIntervalMs / speed);
        return () => clearInterval(timer);
    }, [playing, speed, maxStep, baseIntervalMs]);

    // Stop when playback moves into the completed step (maxStep + 1).
    useEffect(() => {
        if (playing && step > maxStep) setPlaying(false);
    }, [playing, step, maxStep]);

    const togglePlay = useCallback(() => {
        if (playing) {
            setPlaying(false);
            return;
        }
        // Start again from the beginning if playback is at or after the end.
        setStep(prev => (prev >= maxStep ? IDLE_STEP : prev));
        setPlaying(true);
    }, [playing, maxStep]);

    const stepFwd = useCallback(() => {
        setPlaying(false);
        setStep(s => Math.min(s + 1, maxStep));
    }, [maxStep]);

    const stepBk = useCallback(() => {
        setPlaying(false);
        setStep(s => Math.max(s - 1, IDLE_STEP));
    }, []);

    const reset = useCallback(() => {
        setPlaying(false);
        setStep(IDLE_STEP);
    }, []);

    const showAll = useCallback(() => {
        setPlaying(false);
        setStep(maxStep + 1);
    }, [maxStep]);

    return {
        step, playing, speed, setStep, setSpeed,
        isCompleted: step > maxStep,
        togglePlay, stepFwd, stepBk, reset, showAll, stopPlaying,
    };
}
