import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HubDiagram from './HubDiagram';

describe('HubDiagram', () => {
    it('tells the learner when each node is drawn in one container only', () => {
        const containers = Array.from({ length: 40 }, (_, k) => `c${k}`);
        const clients = Array.from({ length: 30 }, (_, k) => `client${k}`);
        const doc = {
            nodes: [...containers, ...clients, 'svc'].map((id) => ({ 'unique-id': id, 'node-type': 'service', name: id })),
            relationships: [
                ...containers.map((c) => ({ 'unique-id': `in-${c}`, 'relationship-type': { 'deployed-in': { container: c, nodes: ['svc'] } } })),
                ...clients.map((c) => ({ 'unique-id': `${c}-svc`, 'relationship-type': { connects: { source: { node: c }, destination: { node: 'svc' } } } })),
            ],
        };
        render(<HubDiagram jsonText={JSON.stringify(doc)} />);
        expect(screen.getByRole('status')).toHaveTextContent('one container');
    });

    it('shows no notice when every node is drawn in each of its containers', () => {
        render(<HubDiagram jsonText={JSON.stringify({ nodes: [{ 'unique-id': 'a', 'node-type': 'service', name: 'a' }] })} />);
        expect(screen.queryByRole('status')).toBeNull();
    });
});
