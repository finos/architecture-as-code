import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    loadStoredNodePositions,
    saveNodePositions,
    StoredNodePosition,
} from './node-position-service.js';

const mockData: StoredNodePosition[] = [
    { id: 'node-1', position: { x: 100, y: 200 } },
    { id: 'node-2', position: { x: 300, y: 400 } },
];
const title = 'test';
const key = 'test-calmhub-node-positions';

describe('PositionStorage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('creates storage key for localStrorage', () => {
        saveNodePositions('title', mockData);
        const stored = localStorage.getItem('title-calmhub-node-positions');
        expect(stored).not.toBeNull();
    });

    it('saves node positions to localStorage', () => {
        saveNodePositions(title, mockData);
        const stored = localStorage.getItem(key);
        expect(stored).not.toBeNull();
        expect(JSON.parse(stored!)).toEqual(mockData);
    });

    it('loads node positions from localStorage', () => {
        localStorage.setItem(key, JSON.stringify(mockData));
        const loaded = loadStoredNodePositions(title);
        expect(loaded).toEqual(mockData);
    });

    it('returns null if nothing is stored', () => {
        const loaded = loadStoredNodePositions(title);
        expect(loaded).toBeNull();
    });

    it('handles malformed JSON gracefully', () => {
        localStorage.setItem(key, 'this is not json');
        const loaded = loadStoredNodePositions(title);
        expect(loaded).toBeNull();
    });
});
