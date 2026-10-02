import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchVersionsByCustomId, fetchResourceByCustomId } = vi.hoisted(() => ({
    fetchVersionsByCustomId: vi.fn(),
    fetchResourceByCustomId: vi.fn(),
}));

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(function () {
        return { fetchVersionsByCustomId, fetchResourceByCustomId };
    }),
}));

// The real graph is heavy and measures the DOM; stub it and expose the node
// count so the test can assert the miniature received the parsed topology.
vi.mock('reactflow', async () => {
    const actual = await vi.importActual<typeof import('reactflow')>('reactflow');
    return {
        ...actual,
        __esModule: true,
        default: ({ nodes }: { nodes: unknown[] }) => (
            <div data-testid="react-flow" data-node-count={String(nodes.length)} />
        ),
        Handle: () => null,
    };
});

import { ArchitectureThumbnail } from './ArchitectureThumbnail.js';

const architecture = {
    nodes: [
        { 'unique-id': 'region', 'node-type': 'network', name: 'Region', description: 'A region' },
        { 'unique-id': 'service', 'node-type': 'service', name: 'Service', description: 'A service' },
    ],
    relationships: [
        {
            'unique-id': 'region-holds-service',
            'relationship-type': { 'composed-of': { container: 'region', nodes: ['service'] } },
        },
    ],
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ArchitectureThumbnail', () => {
    it('fetches the latest version and renders a miniature of the parsed diagram', async () => {
        fetchVersionsByCustomId.mockResolvedValue(['1.0.0', '1.1.0']);
        fetchResourceByCustomId.mockResolvedValue({ data: architecture });

        render(<ArchitectureThumbnail namespace="fluxrig" customId="payment-switch" />);

        await waitFor(() => expect(screen.getByTestId('react-flow')).toBeInTheDocument());
        expect(fetchVersionsByCustomId).toHaveBeenCalledWith(
            'fluxrig',
            'payment-switch',
            'Architectures'
        );
        expect(fetchResourceByCustomId).toHaveBeenCalledWith(
            'fluxrig',
            'payment-switch',
            '1.1.0',
            'Architectures'
        );
        expect(screen.getByTestId('react-flow')).toHaveAttribute('data-node-count', '2');
    });

    it('renders nothing when the architecture has no stored versions', async () => {
        fetchVersionsByCustomId.mockResolvedValue([]);

        render(<ArchitectureThumbnail namespace="fluxrig" customId="empty" />);

        await waitFor(() => expect(fetchVersionsByCustomId).toHaveBeenCalled());
        expect(fetchResourceByCustomId).not.toHaveBeenCalled();
        expect(screen.queryByTestId('react-flow')).not.toBeInTheDocument();
    });

    it('renders nothing when the fetch fails', async () => {
        fetchVersionsByCustomId.mockRejectedValue(new Error('boom'));

        render(<ArchitectureThumbnail namespace="fluxrig" customId="broken" />);

        await waitFor(() => expect(fetchVersionsByCustomId).toHaveBeenCalled());
        expect(screen.queryByTestId('react-flow')).not.toBeInTheDocument();
    });
});
