import { describe, it, expect } from 'vitest';
import {
    apiResponseToStoredPositions,
    layoutMapToStoredPositions,
    storedPositionsToLayoutMap,
} from './layout.js';

describe('layout model', () => {
    describe('apiResponseToStoredPositions', () => {
        it('parses the new nodes-map format with dimensions', () => {
            const response = {
                for: '/api/calm/namespaces/demo/architectures/1',
                nodes: {
                    'node-a': { x: 10, y: 20, w: 100, h: 50 },
                    'node-b': { x: 30, y: 40, w: 200, h: 80 },
                },
            };
            expect(apiResponseToStoredPositions(response)).toEqual([
                { id: 'node-a', position: { x: 10, y: 20 }, width: 100, height: 50 },
                { id: 'node-b', position: { x: 30, y: 40 }, width: 200, height: 80 },
            ]);
        });

        it('parses the new nodes-map format without dimensions', () => {
            const response = {
                nodes: { 'node-a': { x: 5, y: 6 } },
            };
            expect(apiResponseToStoredPositions(response)).toEqual([
                { id: 'node-a', position: { x: 5, y: 6 } },
            ]);
        });

        it('parses the legacy pins array format', () => {
            const response = {
                pins: [
                    { 'unique-id': 'node-a', position: { x: 10, y: 20 } },
                    { 'unique-id': 'node-b', position: { x: 30, y: 40 } },
                ],
            };
            expect(apiResponseToStoredPositions(response)).toEqual([
                { id: 'node-a', position: { x: 10, y: 20 } },
                { id: 'node-b', position: { x: 30, y: 40 } },
            ]);
        });

        it('returns empty array when neither nodes nor pins exist', () => {
            expect(apiResponseToStoredPositions({})).toEqual([]);
        });

        it('prefers nodes over pins when both exist', () => {
            const response = {
                nodes: { 'from-nodes': { x: 1, y: 2 } },
                pins: [{ 'unique-id': 'from-pins', position: { x: 3, y: 4 } }],
            };
            const result = apiResponseToStoredPositions(response);
            expect(result).toEqual([{ id: 'from-nodes', position: { x: 1, y: 2 } }]);
        });
    });

    describe('layoutMapToStoredPositions', () => {
        it('converts a LayoutMap to StoredNodePositions with dimensions', () => {
            const map = {
                'node-a': { x: 10, y: 20, w: 100, h: 50 },
            };
            expect(layoutMapToStoredPositions(map)).toEqual([
                { id: 'node-a', position: { x: 10, y: 20 }, width: 100, height: 50 },
            ]);
        });

        it('converts a LayoutMap without dimensions', () => {
            const map = {
                'node-a': { x: 10, y: 20 },
            };
            expect(layoutMapToStoredPositions(map)).toEqual([
                { id: 'node-a', position: { x: 10, y: 20 } },
            ]);
        });
    });

    describe('storedPositionsToLayoutMap', () => {
        it('converts positions with dimensions to a LayoutMap', () => {
            const positions = [
                { id: 'node-a', position: { x: 10.4, y: 20.7 }, width: 100.2, height: 50.9 },
            ];
            expect(storedPositionsToLayoutMap(positions)).toEqual({
                'node-a': { x: 10, y: 21, w: 100, h: 51 },
            });
        });

        it('converts positions without dimensions (omits w/h)', () => {
            const positions = [
                { id: 'node-a', position: { x: 10, y: 20 } },
            ];
            expect(storedPositionsToLayoutMap(positions)).toEqual({
                'node-a': { x: 10, y: 20 },
            });
        });

        it('rounds all values to integers', () => {
            const positions = [
                { id: 'n', position: { x: 1.1, y: 2.9 }, width: 100.5, height: 50.4 },
            ];
            const result = storedPositionsToLayoutMap(positions);
            expect(result['n']).toEqual({ x: 1, y: 3, w: 101, h: 50 });
        });
    });
});
