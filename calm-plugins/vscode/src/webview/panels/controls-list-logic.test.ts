import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the ControlsList value-input logic.
 *
 * The component is React, but the core behavior we need to verify is:
 * 1. Dropdown (immediate=true) flushes onUpdate synchronously
 * 2. Text input (immediate=false) debounces onUpdate by 300ms
 * 3. Rapid keystrokes only fire one update (debounce resets)
 * 4. Debounced flush reads the latest controls, not a stale closure
 */

interface ControlEntry {
    description?: string;
    requirements?: Array<{ 'requirement-url'?: string; config?: { value?: string } }>;
    metadata?: { validation?: unknown };
}

function createFlushLogic(
    controlsRef: { current: Record<string, ControlEntry> | undefined },
    onUpdate: (controls: Record<string, ControlEntry>) => void
) {
    const timers: Record<string, ReturnType<typeof setTimeout>> = {};

    function handleValueInput(key: string, value: string, immediate = false) {
        clearTimeout(timers[key]);
        const flush = () => {
            const latest = controlsRef.current ?? {};
            const updated = { ...latest };
            const ctrl = { ...updated[key] };
            const reqs = [...(ctrl.requirements ?? [])];
            if (reqs.length === 0) reqs.push({ 'requirement-url': '' });
            reqs[0] = { ...reqs[0], config: { value } };
            ctrl.requirements = reqs;
            updated[key] = ctrl;
            onUpdate(updated);
        };
        if (immediate) flush();
        else timers[key] = setTimeout(flush, 300);
    }

    function handleRemove(key: string) {
        clearTimeout(timers[key]);
        const u = { ...(controlsRef.current ?? {}) };
        delete u[key];
        controlsRef.current = u;
        onUpdate(u);
    }

    function handleRename(oldKey: string, newKey: string) {
        clearTimeout(timers[oldKey]);
        const existing = controlsRef.current ?? {};
        const updated: Record<string, ControlEntry> = {};
        for (const [k, v] of Object.entries(existing)) {
            if (k === oldKey) updated[newKey] = v;
            else updated[k] = v;
        }
        controlsRef.current = updated;
        onUpdate(updated);
    }

    return { handleValueInput, handleRemove, handleRename };
}

describe('ControlsList handleValueInput logic', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('immediate=true calls onUpdate synchronously', () => {
        const onUpdate = vi.fn();
        const controlsRef = {
            current: { 'api-gw': { requirements: [{ config: { value: '' } }] } },
        };
        const { handleValueInput } = createFlushLogic(controlsRef, onUpdate);

        handleValueInput('api-gw', 'Stratum', true);

        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate.mock.calls[0][0]['api-gw'].requirements[0].config.value).toBe('Stratum');
    });

    it('immediate=false debounces onUpdate by 300ms', () => {
        const onUpdate = vi.fn();
        const controlsRef = {
            current: { 'api-gw': { requirements: [{ config: { value: '' } }] } },
        };
        const { handleValueInput } = createFlushLogic(controlsRef, onUpdate);

        handleValueInput('api-gw', 'S');
        expect(onUpdate).not.toHaveBeenCalled();

        vi.advanceTimersByTime(299);
        expect(onUpdate).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate.mock.calls[0][0]['api-gw'].requirements[0].config.value).toBe('S');
    });

    it('rapid keystrokes reset the debounce — only the last value fires', () => {
        const onUpdate = vi.fn();
        const controlsRef = {
            current: { 'api-gw': { requirements: [{ config: { value: '' } }] } },
        };
        const { handleValueInput } = createFlushLogic(controlsRef, onUpdate);

        handleValueInput('api-gw', 'S');
        vi.advanceTimersByTime(100);
        handleValueInput('api-gw', 'St');
        vi.advanceTimersByTime(100);
        handleValueInput('api-gw', 'Str');
        vi.advanceTimersByTime(100);
        handleValueInput('api-gw', 'Stra');

        expect(onUpdate).not.toHaveBeenCalled();

        vi.advanceTimersByTime(300);
        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate.mock.calls[0][0]['api-gw'].requirements[0].config.value).toBe('Stra');
    });

    it('debounced flush reads the latest controls ref (no stale closure)', () => {
        const onUpdate = vi.fn();
        const controlsRef: { current: Record<string, ControlEntry> } = {
            current: {
                'api-gw': { requirements: [{ config: { value: '' } }] },
                'health': { requirements: [{ config: { value: '/health' } }] },
            },
        };
        const { handleValueInput } = createFlushLogic(controlsRef, onUpdate);

        // Start typing in api-gw
        handleValueInput('api-gw', 'Stratum');

        // Simulate: another update changes the health control before the timer fires
        controlsRef.current = {
            ...controlsRef.current,
            'health': { requirements: [{ config: { value: '/actuator' } }] },
        };

        vi.advanceTimersByTime(300);

        expect(onUpdate).toHaveBeenCalledTimes(1);
        const result = onUpdate.mock.calls[0][0];
        // api-gw was updated to Stratum
        expect(result['api-gw'].requirements[0].config.value).toBe('Stratum');
        // health was NOT reverted to /health — it kept the ref-updated /actuator
        expect(result['health'].requirements[0].config.value).toBe('/actuator');
    });

    it('different controls have independent debounce timers', () => {
        const onUpdate = vi.fn();
        const controlsRef: { current: Record<string, ControlEntry> } = {
            current: {
                'api-gw': { requirements: [{ config: { value: '' } }] },
                'health': { requirements: [{ config: { value: '' } }] },
            },
        };
        const { handleValueInput } = createFlushLogic(controlsRef, onUpdate);

        handleValueInput('api-gw', 'Stratum');
        vi.advanceTimersByTime(200);
        handleValueInput('health', '/health');

        // api-gw fires at 300ms, health at 500ms
        vi.advanceTimersByTime(100);
        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate.mock.calls[0][0]['api-gw'].requirements[0].config.value).toBe('Stratum');

        // Update the ref to include api-gw's new value (simulates React re-render)
        controlsRef.current = onUpdate.mock.calls[0][0];

        vi.advanceTimersByTime(200);
        expect(onUpdate).toHaveBeenCalledTimes(2);
        const result = onUpdate.mock.calls[1][0];
        expect(result['health'].requirements[0].config.value).toBe('/health');
        // api-gw's value is preserved because flush reads from the ref
        expect(result['api-gw'].requirements[0].config.value).toBe('Stratum');
    });

    it('removing a control cancels its pending debounce timer', () => {
        const onUpdate = vi.fn();
        const controlsRef: { current: Record<string, ControlEntry> } = {
            current: {
                'api-gw': { requirements: [{ config: { value: '' } }] },
                'health': { requirements: [{ config: { value: '/health' } }] },
            },
        };
        const { handleValueInput, handleRemove } = createFlushLogic(controlsRef, onUpdate);

        // Start typing in api-gw (sets 300ms timer)
        handleValueInput('api-gw', 'Stratum');
        expect(onUpdate).not.toHaveBeenCalled();

        // Remove api-gw before the timer fires
        handleRemove('api-gw');
        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate.mock.calls[0][0]['api-gw']).toBeUndefined();

        // Advance past the original 300ms — the timer must NOT resurrect api-gw
        vi.advanceTimersByTime(500);
        expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it('renaming a control cancels its pending debounce timer under the old key', () => {
        const onUpdate = vi.fn();
        const controlsRef: { current: Record<string, ControlEntry> } = {
            current: {
                'api-gw': { requirements: [{ config: { value: '' } }] },
            },
        };
        const { handleValueInput, handleRename } = createFlushLogic(controlsRef, onUpdate);

        // Start typing in api-gw (sets 300ms timer)
        handleValueInput('api-gw', 'Stratum');

        // Rename api-gw → gateway before the timer fires
        handleRename('api-gw', 'gateway');
        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate.mock.calls[0][0]['gateway']).toBeDefined();
        expect(onUpdate.mock.calls[0][0]['api-gw']).toBeUndefined();

        // Advance past the original 300ms — old key must NOT reappear
        vi.advanceTimersByTime(500);
        expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it('creates a requirement entry when control has no requirements', () => {
        const onUpdate = vi.fn();
        const controlsRef = {
            current: { 'new-ctrl': {} as ControlEntry },
        };
        const { handleValueInput } = createFlushLogic(controlsRef, onUpdate);

        handleValueInput('new-ctrl', 'test-value', true);

        expect(onUpdate).toHaveBeenCalledTimes(1);
        const ctrl = onUpdate.mock.calls[0][0]['new-ctrl'];
        expect(ctrl.requirements).toHaveLength(1);
        expect(ctrl.requirements[0].config.value).toBe('test-value');
    });
});
