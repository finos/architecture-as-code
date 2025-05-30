import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { JsonRenderer } from './JsonRenderer.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalmType } from '../../../model/calm.js';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: vi.fn(),
    };
});

describe('JsonRenderer', () => {
    const mockNavigate = vi.fn();

    beforeEach(() => {
        vi.mocked(useNavigate).mockReturnValue(mockNavigate);
        mockNavigate.mockClear();
    });

    it('renders default message when jsonString is undefined', () => {
        render(
            <MemoryRouter>
                <JsonRenderer json={undefined} />
            </MemoryRouter>
        );
        expect(screen.getByText(/please select a document to load/i)).toBeInTheDocument();
        expect(screen.queryByText(/visualize/i)).not.toBeInTheDocument();
    });

    it('renders JsonView and Visualize button when jsonString is provided', () => {
        const data = {
            id: '42',
            version: '0.0.1',
            name: 'bar',
            calmType: CalmType.Architecture,
            data: undefined,
        };
        render(
            <MemoryRouter>
                <JsonRenderer json={data} />
            </MemoryRouter>
        );
        expect(screen.getByText(/visualize/i)).toBeInTheDocument();
        expect(screen.getByText(/name/i)).toBeInTheDocument();
        expect(screen.getByText(/bar/i)).toBeInTheDocument();
        expect(screen.getByText(/data/i)).toBeInTheDocument();
        expect(screen.getByText(/undefined/i)).toBeInTheDocument();
    });

    it('navigates to /visualizer with state when Visualize button is clicked', () => {
        const data = {
            id: '42',
            version: '0.0.1',
            name: 'bar',
            calmType: CalmType.Architecture,
            data: undefined,
        };
        render(
            <MemoryRouter>
                <JsonRenderer json={data} />
            </MemoryRouter>
        );
        const button = screen.getByText(/visualize/i);
        fireEvent.click(button);
        expect(mockNavigate).toHaveBeenCalledWith('/visualizer', { state: data });
    });
});
