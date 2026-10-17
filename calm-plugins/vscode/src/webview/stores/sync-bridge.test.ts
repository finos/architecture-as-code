import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Capture posted messages and the registered window 'message' listener so we can
// drive the correlation logic without a real webview.
const { posted } = vi.hoisted(() => ({ posted: [] as Array<Record<string, unknown>> }));
vi.mock('../vscode-api', () => ({
    postMessage: (m: Record<string, unknown>) => {
        posted.push(m);
    },
}));

let listeners: Array<(e: { data: unknown }) => void>;

import {
    initBridge,
    requestControlBrowse,
    requestControlsForDomain,
    requestControlVersions,
    requestControlResolve,
    requestSaveControl,
} from './sync-bridge';

function dispatch(msg: unknown): void {
    for (const l of listeners) l({ data: msg });
}

function lastRequestId(type: string): string {
    const msg = [...posted].reverse().find((m) => m.type === type);
    return msg?.requestId as string;
}

let bridgeStarted = false;

beforeEach(() => {
    posted.length = 0;
    listeners = [];
    vi.stubGlobal('window', {
        addEventListener: (type: string, cb: (e: { data: unknown }) => void) => {
            if (type === 'message') listeners.push(cb);
        },
        removeEventListener: () => {},
    });
    // initBridge registers the message listener exactly once for the module.
    if (!bridgeStarted) {
        initBridge();
        bridgeStarted = true;
    } else {
        // Re-register the listener against the fresh stub for subsequent tests.
        initBridge();
    }
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('control request correlation', () => {
    it('round-trips a browse request to its callback by requestId', () => {
        const cb = vi.fn();
        requestControlBrowse(cb);
        const requestId = lastRequestId('requestControlBrowse');
        expect(requestId).toBeTruthy();

        dispatch({ type: 'controlBrowseResult', requestId, ok: true, groups: [] });
        expect(cb).toHaveBeenCalledWith({ ok: true, groups: [] });
    });

    it('delivers error results', () => {
        const cb = vi.fn();
        requestControlsForDomain('security', cb);
        const requestId = lastRequestId('requestControlsForDomain');
        dispatch({ type: 'controlDomainResult', requestId, ok: false, error: 'boom' });
        expect(cb).toHaveBeenCalledWith({ ok: false, error: 'boom' });
    });

    it('ignores a response with an unknown requestId (stale)', () => {
        const cb = vi.fn();
        requestControlVersions('security', 'x', cb);
        dispatch({ type: 'controlVersionsResult', requestId: 'nope', ok: true, versions: ['1.0.0'] });
        expect(cb).not.toHaveBeenCalled();
    });

    it('routes each concurrent request to its own callback', () => {
        const cb1 = vi.fn();
        const cb2 = vi.fn();
        requestControlResolve('controls/a.requirement.json', cb1);
        const id1 = lastRequestId('requestControlResolve');
        requestControlResolve('controls/b.requirement.json', cb2);
        const id2 = lastRequestId('requestControlResolve');
        expect(id1).not.toBe(id2);

        const parsed = { identity: { controlId: 'c', name: 'n', description: 'd' }, properties: {} };
        dispatch({ type: 'controlResolveResult', requestId: id2, ok: true, parsed, warnings: [] });
        expect(cb2).toHaveBeenCalledWith({ ok: true, parsed, warnings: [] });
        expect(cb1).not.toHaveBeenCalled();
    });

    it('does not double-fire a callback for a duplicate response', () => {
        const cb = vi.fn();
        requestSaveControl('x.requirement.json', '{}', cb);
        const requestId = lastRequestId('saveControl');
        dispatch({ type: 'saveControlResult', requestId, ok: true });
        dispatch({ type: 'saveControlResult', requestId, ok: true });
        expect(cb).toHaveBeenCalledTimes(1);
    });
});

describe('timeout cleanup', () => {
    it('invokes the callback with a timeout error after the deadline', () => {
        vi.useFakeTimers();
        const cb = vi.fn();
        requestControlBrowse(cb);
        vi.advanceTimersByTime(15000);
        expect(cb).toHaveBeenCalledWith({ ok: false, error: 'timeout' });
    });

    it('a late response after timeout does not fire the callback again', () => {
        vi.useFakeTimers();
        const cb = vi.fn();
        requestControlBrowse(cb);
        const requestId = lastRequestId('requestControlBrowse');
        vi.advanceTimersByTime(15000);
        cb.mockClear();
        dispatch({ type: 'controlBrowseResult', requestId, ok: true, groups: [] });
        expect(cb).not.toHaveBeenCalled();
    });
});
