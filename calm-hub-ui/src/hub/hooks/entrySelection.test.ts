import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../../test-support/memory-storage.js';
import { readEntrySelection, writeEntrySelection } from './entrySelection.js';

const entry = (key: string) => ({ key, pathname: '/finos/architectures/pay/1.0.0', search: '' });
const fakeHistory = (initial: unknown = null) => {
    const history = {
        state: initial,
        replaceState: (next: unknown) => {
            history.state = next;
        },
    };
    return history;
};

describe('entry selection', () => {
    it('keeps the selection of the last 50 history entries only', () => {
        const storage = createMemoryStorage();
        for (let index = 0; index < 51; index++) writeEntrySelection(storage, entry(`k${index}`), `node-${index}`);
        expect(readEntrySelection(storage, entry('k0'))).toBeUndefined();
        expect(readEntrySelection(storage, entry('k1'))).toBe('node-1');
        expect(readEntrySelection(storage, entry('k50'))).toBe('node-50');

        writeEntrySelection(storage, entry('k50'), undefined);
        expect(readEntrySelection(storage, entry('k50'))).toBeUndefined();
    });

    it('gives each entry that the router did not create its own id, also at the same URL, and keeps it after a reload', () => {
        const storage = createMemoryStorage();
        const first = fakeHistory({ idx: 0 });
        writeEntrySelection(storage, entry('default'), 'x', first);
        expect(first.state).toEqual({ idx: 0, calmHubEntry: expect.any(String) });
        expect(readEntrySelection(storage, entry('default'), first)).toBe('x');
        expect(readEntrySelection(storage, entry('default'), fakeHistory(first.state))).toBe('x');

        const second = fakeHistory();
        expect(readEntrySelection(storage, entry('default'), second)).toBeUndefined();
        writeEntrySelection(storage, entry('default'), undefined, second);
        expect(second.state).toBeNull();
        writeEntrySelection(storage, entry('default'), 'y', second);
        expect(readEntrySelection(storage, entry('default'), second)).toBe('y');
        expect(readEntrySelection(storage, entry('default'), first)).toBe('x');
    });

    it('does not take the history state of an entry that the router made', () => {
        const storage = createMemoryStorage();
        const routed = fakeHistory({ usr: null, key: 'k1', idx: 1 });
        writeEntrySelection(storage, entry('default'), 'x', routed);
        expect(routed.state).toEqual({ usr: null, key: 'k1', idx: 1 });
        expect(storage.getItem('calm-hub-entry-selection')).toBeNull();
    });

    it('reads nothing from a value that is not its own', () => {
        const storage = createMemoryStorage();
        storage.setItem('calm-hub-entry-selection', '{"k1":"node"}');
        expect(readEntrySelection(storage, entry('k1'))).toBeUndefined();
        storage.setItem('calm-hub-entry-selection', '[["k1",7],["k2","node"]]');
        expect(readEntrySelection(storage, entry('k1'))).toBeUndefined();
        expect(readEntrySelection(storage, entry('k2'))).toBe('node');
    });
});
