import { useSyncExternalStore } from 'react';

let revision = 0;
const listeners = new Set<() => void>();

export function invalidateFeatureRuntime(): void {
    revision++;
    listeners.forEach((listener) => listener());
}

export function useFeatureRuntimeRevision(): number {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        () => revision,
        () => revision,
    );
}