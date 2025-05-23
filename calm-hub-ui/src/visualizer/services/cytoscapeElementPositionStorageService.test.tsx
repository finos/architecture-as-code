import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    CytoscapeElementPositionStorage,
    StoredNodePosition,
} from './cytoscapeElementPositionStorageService.js';

const mockData: StoredNodePosition[] = [
    { id: 'node-1', position: { x: 100, y: 200 } },
    { id: 'node-2', position: { x: 300, y: 400 } },
];

describe('PositionStorage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('saves node positions to localStorage', () => {
        CytoscapeElementPositionStorage.save(mockData);
        const stored = localStorage.getItem('cytoscapeNodePositions');
        expect(stored).not.toBeNull();
        expect(JSON.parse(stored!)).toEqual(mockData);
    });

    it('loads node positions from localStorage', () => {
        localStorage.setItem('cytoscapeNodePositions', JSON.stringify(mockData));
        const loaded = CytoscapeElementPositionStorage.load();
        expect(loaded).toEqual(mockData);
    });

    it('returns null if nothing is stored', () => {
        const loaded = CytoscapeElementPositionStorage.load();
        expect(loaded).toBeNull();
    });

    it('clears node positions from localStorage', () => {
        CytoscapeElementPositionStorage.save(mockData);
        CytoscapeElementPositionStorage.clear();
        expect(localStorage.getItem('cytoscapeNodePositions')).toBeNull();
    });

    it('handles malformed JSON gracefully', () => {
        localStorage.setItem('cytoscapeNodePositions', 'this is not json');
        const loaded = CytoscapeElementPositionStorage.load();
        expect(loaded).toBeNull();
    });
});
