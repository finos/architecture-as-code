import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';

export interface ActionOutcome {
    /** The key of the context the call was for. */
    for: string;
    ok: boolean;
}

/**
 * The actions with a call in flight, by extension and contribution, and the result of the last call, by button. They
 * are kept outside the button, so a remount (a collapsed section, a filter, a tab change) cannot enable a write that
 * is still running, or lose the result of a write that ends while the button is not on screen. A call in flight
 * disables each button of the action; a result shows only on the button that ran it.
 */
export class ActionRuns {
    private readonly running = new Set<string>();
    // The buttons that started a call in flight, so only that button says that it runs.
    private readonly runningButtons = new Set<string>();
    private readonly outcomes = new Map<string, ActionOutcome>();
    private readonly listeners = new Set<() => void>();

    isRunning(key: string): boolean {
        return this.running.has(key);
    }

    isRunningOn(outcomeKey: string): boolean {
        return this.runningButtons.has(outcomeKey);
    }

    outcome(key: string): ActionOutcome | undefined {
        return this.outcomes.get(key);
    }

    start(key: string, outcomeKey: string): void {
        this.running.add(key);
        this.runningButtons.add(outcomeKey);
        this.outcomes.delete(outcomeKey);
        this.notify();
    }

    finish(key: string, outcomeKey: string, outcome?: ActionOutcome): void {
        const wasRunning = this.running.delete(key);
        this.runningButtons.delete(outcomeKey);
        if (outcome) this.outcomes.set(outcomeKey, outcome);
        if (wasRunning || outcome) this.notify();
    }

    clearOutcome(key: string): void {
        if (this.outcomes.delete(key)) this.notify();
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify() {
        this.listeners.forEach((listener) => listener());
    }
}

export const ActionRunsContext = createContext<ActionRuns | null>(null);

export const actionRunKey = (extensionId: string, contributionId: string) => JSON.stringify([extensionId, contributionId]);

/** One button of an action. `placement` names where the button is, and must not change across a remount. */
export const actionButtonKey = (extensionId: string, contributionId: string, placement: string) =>
    JSON.stringify([extensionId, contributionId, placement]);

/** The provider's runs. Outside a provider, such as in a test, each component gets its own. */
export function useActionRuns(): ActionRuns {
    const shared = useContext(ActionRunsContext);
    return useMemo(() => shared ?? new ActionRuns(), [shared]);
}

export function useActionRunning(runs: ActionRuns, key: string): boolean {
    return useSyncExternalStore(
        (listener) => runs.subscribe(listener),
        () => runs.isRunning(key),
    );
}

export function useActionRunningOn(runs: ActionRuns, outcomeKey: string): boolean {
    return useSyncExternalStore(
        (listener) => runs.subscribe(listener),
        () => runs.isRunningOn(outcomeKey),
    );
}

export function useActionOutcome(runs: ActionRuns, key: string): ActionOutcome | undefined {
    return useSyncExternalStore(
        (listener) => runs.subscribe(listener),
        () => runs.outcome(key),
    );
}
