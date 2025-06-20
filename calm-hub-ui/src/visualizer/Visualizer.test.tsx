import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Visualizer from './Visualizer.js';
import { MemoryRouter, useLocation } from 'react-router-dom';

vi.mock('./components/drawer/Drawer.js', () => ({
    Drawer: ({ calmInstance, title, data }: any) => (
        <div data-testid="drawer">
            <span>{title}</span>
            <span>{JSON.stringify(calmInstance)}</span>
            <span>{JSON.stringify(data)}</span>
        </div>
    ),
}));
vi.mock('../components/navbar/Navbar.js', () => ({
    Navbar: () => <nav data-testid="navbar" />,
}));

const mockFileContent = JSON.stringify({ foo: 'bar' });
const mockFile = {
    name: 'test.json',
    type: 'application/json',
    text: () => Promise.resolve(mockFileContent),
};
vi.mock('./components/menu/Menu.js', () => ({
    Menu: ({ handleUpload }: any) => (
        <button data-testid="upload" onClick={() => handleUpload(mockFile)}>
            Upload Architecture
        </button>
    ),
}));

describe('Visualizer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders Navbar, Menu, and Drawer', () => {
        render(
            <MemoryRouter>
                <Visualizer />
            </MemoryRouter>
        );
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
        expect(screen.getByTestId('upload')).toBeInTheDocument();
        expect(screen.getByTestId('drawer')).toBeInTheDocument();
    });

    it('uses location.state data for title and calmInstance', () => {
        const state = {
            name: 'Test Title',
            data: {
                id: 'test-id',
                version: '1.0.0',
                name: 'test-name',
                calmType: 'Architectures',
                data: { key: 'value' },
            },
        };
        const Wrapper = ({ children }: any) => (
            <MemoryRouter initialEntries={[{ pathname: '/', state }]}>{children}</MemoryRouter>
        );
        render(
            <Wrapper>
                <Visualizer />
            </Wrapper>
        );
        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText(JSON.stringify(state.data))).toBeInTheDocument();
    });

    it('updates title and calmInstance when file is uploaded', async () => {
        render(
            <MemoryRouter>
                <Visualizer />
            </MemoryRouter>
        );
        fireEvent.click(screen.getByTestId('upload'));
        await waitFor(() => {
            expect(screen.getByText('test.json')).toBeInTheDocument();
        });
    });

    it('falls back to location.state if no file uploaded', () => {
        const state = { name: 'Fallback Title', data: { fallback: true } };
        const Wrapper = ({ children }: any) => (
            <MemoryRouter initialEntries={[{ pathname: '/', state }]}>{children}</MemoryRouter>
        );
        render(
            <Wrapper>
                <Visualizer />
            </Wrapper>
        );
        expect(screen.getByText('Fallback Title')).toBeInTheDocument();
        expect(screen.getByText(JSON.stringify({ fallback: true }))).toBeInTheDocument();
    });
});
