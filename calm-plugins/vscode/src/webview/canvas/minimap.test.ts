import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import { minimapNodeClassName } from './minimap';

function node(type: string): Node {
    return { id: 'n', type, position: { x: 0, y: 0 }, data: {} };
}

describe('minimapNodeClassName', () => {
    it('marks container nodes', () => {
        expect(minimapNodeClassName(node('container'))).toBe('calm-minimap-container');
    });

    it('leaves other nodes unmarked', () => {
        for (const type of ['service', 'database', 'system']) {
            expect(minimapNodeClassName(node(type))).toBe('');
        }
    });
});
