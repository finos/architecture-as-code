import { create } from 'zustand';
import { invalidateFeatureRuntime } from '../runtime-invalidation';

export type FlowPlaybackSpeed = 0.5 | 1 | 1.5 | 2;

interface FlowPlaybackState {
    step: number;
    playing: boolean;
    speed: FlowPlaybackSpeed;
    setStep: (step: number | ((current: number) => number)) => void;
    setPlaying: (playing: boolean) => void;
    setSpeed: (speed: FlowPlaybackSpeed) => void;
    reset: () => void;
}

export const useFlowPlaybackStore = create<FlowPlaybackState>((set) => ({
    step: 0,
    playing: false,
    speed: 1,
    setStep: (step) => {
        set((state) => ({ step: typeof step === 'function' ? step(state.step) : step }));
        // Canvas transforms read this store outside React; invalidate the generic canvas view.
        invalidateFeatureRuntime();
    },
    setPlaying: (playing) => {
        set({ playing });
        invalidateFeatureRuntime();
    },
    setSpeed: (speed) => {
        set({ speed });
        invalidateFeatureRuntime();
    },
    reset: () => {
        set({ step: 0, playing: false });
        invalidateFeatureRuntime();
    },
}));