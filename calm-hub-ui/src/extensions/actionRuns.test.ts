import { describe, expect, it, vi } from 'vitest';
import { ActionRuns, actionButtonKey, actionRunKey } from './actionRuns.js';

describe('ActionRuns', () => {
    const key = actionRunKey('ext', 'scan');
    const button = actionButtonKey('ext', 'scan', 'tab');

    it('tells listeners when a run starts and finishes, and not after they unsubscribe', () => {
        const runs = new ActionRuns();
        const listener = vi.fn();
        const unsubscribe = runs.subscribe(listener);

        runs.start(key, button);
        expect(runs.isRunning(key)).toBe(true);
        runs.finish(key, button);
        expect(runs.isRunning(key)).toBe(false);
        runs.finish(key, button);
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        runs.start(key, button);
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('keeps the last result of a button until it starts a new run or it is cleared', () => {
        const runs = new ActionRuns();
        const listener = vi.fn();
        runs.subscribe(listener);

        runs.start(key, button);
        runs.finish(key, button, { for: 'a', ok: true });
        expect(runs.outcome(button)).toEqual({ for: 'a', ok: true });
        runs.start(key, button);
        expect(runs.outcome(button)).toBeUndefined();
        runs.finish(key, button, { for: 'a', ok: false });
        runs.clearOutcome(button);
        expect(runs.outcome(button)).toBeUndefined();
        runs.clearOutcome(button);
        runs.finish(key, button, { for: 'b', ok: true });
        expect(listener).toHaveBeenCalledTimes(6);
    });

    it('knows which button started the call in flight', () => {
        const runs = new ActionRuns();
        const other = actionButtonKey('ext', 'scan', 'details');
        runs.start(key, button);
        expect(runs.isRunningOn(button)).toBe(true);
        expect(runs.isRunningOn(other)).toBe(false);
        runs.finish(key, button);
        expect(runs.isRunningOn(button)).toBe(false);
    });

    it('keeps the result of each button of an action apart', () => {
        const runs = new ActionRuns();
        const other = actionButtonKey('ext', 'scan', 'details');
        runs.start(key, button);
        runs.finish(key, button, { for: 'a', ok: true });
        runs.start(key, other);
        expect(runs.outcome(button)).toEqual({ for: 'a', ok: true });
        runs.finish(key, other, { for: 'a', ok: false });
        expect(runs.outcome(button)).toEqual({ for: 'a', ok: true });
        expect(runs.outcome(other)).toEqual({ for: 'a', ok: false });
    });

    it('keeps the keys of two extensions apart', () => {
        expect(actionRunKey('a/b', 'c')).not.toBe(actionRunKey('a', 'b/c'));
        expect(actionButtonKey('a', 'b', 'c/d')).not.toBe(actionButtonKey('a', 'b/c', 'd'));
    });
});
