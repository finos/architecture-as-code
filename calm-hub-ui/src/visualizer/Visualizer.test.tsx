import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Visualizer from './Visualizer.js';
import { MemoryRouter } from 'react-router-dom';
import { Data } from '../model/calm.js';
import { ReactNode } from 'react';

vi.mock('./components/drawer/Drawer.js', () => ({
    Drawer: ({ data }: { data?: Data }) => (
        <div data-testid="drawer">
            <span>{JSON.stringify(data?.name)}</span>
            <span>{JSON.stringify(data)}</span>
        </div>
    ),
}));
vi.mock('../components/navbar/Navbar.js', () => ({
    Navbar: () => <nav data-testid="navbar" />,
}));

describe('Visualizer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders Navbar and Drawer', () => {
        render(
            <MemoryRouter>
                <Visualizer />
            </MemoryRouter>
        );
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
        expect(screen.getByTestId('drawer')).toBeInTheDocument();
    });

    it('uses location.state data for title and calmInstance', () => {
        const state = {
            id: 'test-id',
            version: '1.0.0',
            name: 'Test Title',
            calmType: 'Architectures',
            data: { key: 'value' },
        };
        const Wrapper = ({ children }: { children: ReactNode }) => (
            <MemoryRouter initialEntries={[{ pathname: '/', state }]}>{children}</MemoryRouter>
        );
        render(
            <Wrapper>
                <Visualizer />
            </Wrapper>
        );
        expect(screen.getByText('"Test Title"')).toBeInTheDocument();
        expect(screen.getByText(JSON.stringify(state))).toBeInTheDocument();
    });

    it('falls back to location.state if no file uploaded', () => {
        const state = { fallback: true, name: 'Fallback Title' };
        const Wrapper = ({ children }: { children: ReactNode }) => (
            <MemoryRouter initialEntries={[{ pathname: '/', state }]}>{children}</MemoryRouter>
        );
        render(
            <Wrapper>
                <Visualizer />
            </Wrapper>
        );
        expect(screen.getByText('"Fallback Title"')).toBeInTheDocument();
        expect(screen.getByText(JSON.stringify(state))).toBeInTheDocument();
    });
});
