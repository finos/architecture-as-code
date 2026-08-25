import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationStore } from './migration-store.js';

describe('MigrationStore', () => {
    let store: MigrationStore;

    beforeEach(() => {
        store = new MigrationStore();
    });

    it('starts with message null', () => {
        expect(store.getMigrationError()).toBeNull();
    });

    it('setMigrationError updates the stored message', () => {
        store.setMigrationError('CalmHub is applying a schema migration.');
        expect(store.getMigrationError()).toBe('CalmHub is applying a schema migration.');

        store.setMigrationError(null);
        expect(store.getMigrationError()).toBeNull();
    });

    it('notifies subscribed listeners when the message changes', () => {
        const received: (string | null)[] = [];
        store.subscribe((m) => received.push(m));

        store.setMigrationError('migrating');
        store.setMigrationError(null);

        expect(received).toEqual(['migrating', null]);
    });

    it('supports multiple listeners', () => {
        const a: (string | null)[] = [];
        const b: (string | null)[] = [];
        store.subscribe((m) => a.push(m));
        store.subscribe((m) => b.push(m));

        store.setMigrationError('migrating');

        expect(a).toEqual(['migrating']);
        expect(b).toEqual(['migrating']);
    });

    it('unsubscribes when the returned function is called', () => {
        const received: (string | null)[] = [];
        const unsub = store.subscribe((m) => received.push(m));

        store.setMigrationError('migrating');
        unsub();
        store.setMigrationError(null);

        expect(received).toEqual(['migrating']);
    });
});
