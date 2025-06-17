import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Hub from './Hub.js';
import { vi, describe, it, expect } from 'vitest';

vi.mock('./components/value-table/ValueTable', () => ({
    ValueTable: ({
        header,
        values,
        callback,
    }: {
        header: string;
        values: string[];
        callback: (v: string) => void;
    }) => (
        <div data-testid="value-table">
            <div>{header}</div>
            {values.map((v: string) => (
                <button key={v} onClick={() => callback(v)}>
                    {v}
                </button>
            ))}
        </div>
    ),
}));

vi.mock('./components/json-renderer/JsonRenderer', () => ({
    JsonRenderer: ({ json }: { json: unknown }) => (
        <div data-testid="json-renderer">{json ? 'JSON' : ''}</div>
    ),
}));

vi.mock('./components/adr-renderer/AdrRenderer', () => ({
    AdrRenderer: ({ adrDetails }: { adrDetails: { id?: string } }) => (
        <div data-testid="adr-renderer">ADR: {adrDetails?.id}</div>
    ),
}));

vi.mock('../components/navbar/Navbar', () => ({
    Navbar: () => <nav data-testid="navbar">Navbar</nav>,
}));

// Mock calm-service and adr-service
vi.mock('../service/calm-service', () => ({
    fetchNamespaces: (cb: (v: string[]) => void) => cb(['namespace1', 'namespace2']),
    fetchPatternIDs: (namespace: string, cb: (v: string[]) => void) => cb(['pattern1', 'pattern2']),
    fetchFlowIDs: (namespace: string, cb: (v: string[]) => void) => cb(['flow1']),
    fetchArchitectureIDs: (namespace: string, cb: (v: string[]) => void) => cb(['arch1']),
    fetchPatternVersions: (namespace: string, id: string, cb: (v: string[]) => void) =>
        cb(['1.0', '2.0']),
    fetchFlowVersions: (namespace: string, id: string, cb: (v: string[]) => void) => cb(['1.1']),
    fetchArchitectureVersions: (namespace: string, id: string, cb: (v: string[]) => void) =>
        cb(['2.1']),
    fetchPattern: (
        namespace: string,
        id: string,
        v: string,
        cb: (data: { id: string; v: string }) => void
    ) => cb({ id, v }),
    fetchFlow: (
        namespace: string,
        id: string,
        v: string,
        cb: (data: { id: string; v: string }) => void
    ) => cb({ id, v }),
    fetchArchitecture: (
        namespace: string,
        id: string,
        v: string,
        cb: (data: { id: string; v: string }) => void
    ) => cb({ id, v }),
}));

vi.mock('../service/adr-service/adr-service', () => {
    class MockAdrService {
        fetchAdrIDs = vi.fn(async () => ['adr1', 'adr2']);
        fetchAdrRevisions = vi.fn(async () => ['rev1', 'rev2']);
        fetchAdr = vi.fn(async () => ({ id: 'adr1', revision: 'rev1' }));
    }
    return { AdrService: MockAdrService };
});

// Helper to render with router
const renderWithRouter = (ui: React.ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('Hub', () => {
    it('renders Navbar and initial namespaces', async () => {
        renderWithRouter(<Hub />);
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
        expect(screen.getAllByText('Namespaces').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByRole('button', { name: 'namespace1' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'namespace2' })).toBeInTheDocument();
    });

    it('shows Calm Type options after namespace selection', async () => {
        renderWithRouter(<Hub />);
        fireEvent.click(screen.getByText('namespace1'));
        expect(await screen.findByText('Calm Type')).toBeInTheDocument();
        expect(screen.getByText('Architectures')).toBeInTheDocument();
        expect(screen.getByText('Patterns')).toBeInTheDocument();
        expect(screen.getByText('Flows')).toBeInTheDocument();
        expect(screen.getByText('ADRs')).toBeInTheDocument();
    });

    it('shows resource IDs after Calm Type selection', async () => {
        renderWithRouter(<Hub />);
        fireEvent.click(screen.getByText('namespace1'));
        fireEvent.click(screen.getByText('Patterns'));
        expect(screen.getAllByText('Patterns').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByRole('button', { name: 'pattern1' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'pattern2' })).toBeInTheDocument();
    });

    it('shows versions after resource selection', async () => {
        renderWithRouter(<Hub />);
        fireEvent.click(screen.getByText('namespace1'));
        fireEvent.click(screen.getByText('Patterns'));
        fireEvent.click(screen.getByText('pattern1'));
        expect(await screen.findByText('Versions')).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: '1.0' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '2.0' })).toBeInTheDocument();
    });

    it('renders JsonRenderer after version selection', async () => {
        renderWithRouter(<Hub />);
        fireEvent.click(screen.getByText('namespace1'));
        fireEvent.click(screen.getByText('Patterns'));
        fireEvent.click(screen.getByText('pattern1'));
        fireEvent.click(screen.getByText('1.0'));

        expect(await screen.findByTestId('json-renderer')).toBeInTheDocument();
    });

    it('shows ADRs and revisions, and renders AdrRenderer', async () => {
        renderWithRouter(<Hub />);
        fireEvent.click(screen.getByText('namespace1'));
        fireEvent.click(screen.getByText('ADRs'));

        expect(await screen.findByText('adr1')).toBeInTheDocument();
        fireEvent.click(screen.getByText('adr1'));

        expect(await screen.findByText('rev1')).toBeInTheDocument();
        fireEvent.click(screen.getByText('rev1'));

        expect(await screen.findByTestId('adr-renderer')).toBeInTheDocument();
    });

    it('shows breadcrumbs and resets on click', async () => {
        renderWithRouter(<Hub />);
        fireEvent.click(screen.getByText('namespace1'));
        fireEvent.click(screen.getByText('Patterns'));
        fireEvent.click(screen.getByText('pattern1'));
        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Namespaces'));
        expect(await screen.findByText('namespace1')).toBeInTheDocument();
    });
});
