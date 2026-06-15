import { describe, it, expect, beforeEach } from 'vitest';
import { AuthStore } from './auth-store.js';

describe('AuthStore', () => {
    let store: AuthStore;

    beforeEach(() => {
        store = new AuthStore();
    });

    it('starts with status null', () => {
        expect(store.getAuthError()).toBeNull();
    });

    it('setAuthError updates the stored status', () => {
        store.setAuthError(401);
        expect(store.getAuthError()).toBe(401);

        store.setAuthError(403);
        expect(store.getAuthError()).toBe(403);

        store.setAuthError(null);
        expect(store.getAuthError()).toBeNull();
    });

    it('notifies subscribed listeners when the status changes', () => {
        const received: (number | null)[] = [];
        store.subscribe((s) => received.push(s));

        store.setAuthError(401);
        store.setAuthError(null);

        expect(received).toEqual([401, null]);
    });

    it('supports multiple listeners', () => {
        const a: (number | null)[] = [];
        const b: (number | null)[] = [];
        store.subscribe((s) => a.push(s));
        store.subscribe((s) => b.push(s));

        store.setAuthError(403);

        expect(a).toEqual([403]);
        expect(b).toEqual([403]);
    });

    it('unsubscribes when the returned function is called', () => {
        const received: (number | null)[] = [];
        const unsub = store.subscribe((s) => received.push(s));

        store.setAuthError(401);
        unsub();
        store.setAuthError(null);

        expect(received).toEqual([401]);
    });
});
