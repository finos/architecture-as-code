export interface FeatureEvent<T> {
    emit: (value: T) => void;
    subscribe: (listener: (value: T) => void) => () => void;
}

/** Small local command channel for toolbar actions that open feature-owned UI. */
export function createFeatureEvent<T>(): FeatureEvent<T> {
    const listeners = new Set<(value: T) => void>();

    return {
        emit: (value) => listeners.forEach((listener) => listener(value)),
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}