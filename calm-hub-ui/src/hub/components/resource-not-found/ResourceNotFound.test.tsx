import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { ResourceNotFound } from './ResourceNotFound.js';
import { BreadcrumbItem } from '../../../model/calm.js';

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return {
        ...actual,
        useNavigate: vi.fn(function () {
            return vi.fn();
        }),
    };
});

function renderAt(props: Parameters<typeof ResourceNotFound>[0]) {
    return render(
        <MemoryRouter>
            <ResourceNotFound {...props} />
        </MemoryRouter>
    );
}

describe('ResourceNotFound', () => {
    it('echoes the requested resource and always offers the hub root', () => {
        renderAt({ namespace: 'finos', id: 'model-registry', version: '1.0.0', type: 'architectures' });

        expect(screen.getByText('Architecture not found')).toBeInTheDocument();
        expect(screen.getByText('finos/model-registry@1.0.0')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /browse the hub/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /back to/i })).not.toBeInTheDocument();
    });

    it('derives the heading noun from the route type', () => {
        const { rerender } = renderAt({ namespace: 'finos', id: 'model-registry', version: '1.0.0', type: 'architectures' });
        expect(screen.getByText('Architecture not found')).toBeInTheDocument();

        rerender(
            <MemoryRouter>
                <ResourceNotFound namespace="finos" id="api-gateway" version="1.0.0" type="patterns" />
            </MemoryRouter>
        );
        expect(screen.getByText('Pattern not found')).toBeInTheDocument();
    });

    it('falls back to a neutral noun for an unknown or absent type', () => {
        renderAt({ namespace: 'finos', id: 'model-registry', version: '1.0.0' });
        expect(screen.getByText('Resource not found')).toBeInTheDocument();
    });

    it('navigates to the parent crumb with the trail sliced, mirroring a breadcrumb click', async () => {
        const navigate = vi.fn();
        vi.mocked(useNavigate).mockReturnValue(navigate);
        const user = userEvent.setup();
        const crumbs: BreadcrumbItem[] = [
            { namespace: 'finos', type: 'architectures', id: 'payment-service', version: '1.0.0' },
            { namespace: 'finos', type: 'architectures', id: 'ml-scoring-service', version: '1.0.0', name: 'ML Scoring' },
        ];

        renderAt({ namespace: 'finos', id: 'model-registry', version: '1.0.0', breadcrumbs: crumbs });

        await user.click(screen.getByRole('button', { name: 'Back to ML Scoring' }));

        expect(navigate).toHaveBeenCalledWith('/finos/architectures/ml-scoring-service/1.0.0', {
            state: { breadcrumbs: [crumbs[0]] },
        });
    });

    it('navigates home from the hub-root action', async () => {
        const navigate = vi.fn();
        vi.mocked(useNavigate).mockReturnValue(navigate);
        const user = userEvent.setup();

        renderAt({ namespace: 'finos', id: 'model-registry', version: '1.0.0' });

        await user.click(screen.getByRole('button', { name: /browse the hub/i }));

        expect(navigate).toHaveBeenCalledWith('/');
    });

    it('falls back to the parent id when the crumb has no display name', () => {
        const crumbs: BreadcrumbItem[] = [
            { namespace: 'finos', type: 'architectures', id: 'ml-scoring-service', version: '1.0.0' },
        ];

        renderAt({ namespace: 'finos', id: 'model-registry', version: '1.0.0', breadcrumbs: crumbs });

        expect(screen.getByRole('button', { name: 'Back to ml-scoring-service' })).toBeInTheDocument();
    });
});
