import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Position, type Edge, type EdgeProps } from '@xyflow/react';
import { C4RelationshipEdge } from './C4RelationshipEdge.js';
import type { C4RelationshipData } from './c4Layout.js';

vi.mock('@xyflow/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@xyflow/react')>()),
    BaseEdge: () => null,
    EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function renderEdge(label: string, count = 1, technology?: string) {
    const props = {
        id: 'e',
        sourceX: 0,
        sourceY: 0,
        targetX: 100,
        targetY: 0,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: { relationship: { source: 'a', target: 'b', label, technology, count } },
    } as unknown as EdgeProps<Edge<C4RelationshipData>>;
    render(<C4RelationshipEdge {...props} />);
}

describe('C4RelationshipEdge', () => {
    it('shows the first sentence of the description, with the full text as its title', () => {
        renderEdge('Browses the shop. Then buys things.');

        expect(screen.getByTitle('Browses the shop. Then buys things.')).toHaveTextContent(/^Browses the shop$/);
    });

    it('cuts a long first sentence', () => {
        renderEdge(`Sends ${'x'.repeat(80)}`);

        expect(screen.getByTitle(/^Sends/).textContent).toHaveLength(60);
        expect(screen.getByTitle(/^Sends/).textContent).toMatch(/…$/);
    });

    it('shows the technology and how many relationships a lifted one stands for', () => {
        renderEdge('Places orders', 3, 'HTTPS');

        expect(screen.getByTitle('Places orders')).toHaveTextContent('Places orders (3 relationships)[HTTPS]');
    });
});
