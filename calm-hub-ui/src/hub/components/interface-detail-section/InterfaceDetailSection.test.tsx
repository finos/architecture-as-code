import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InterfaceDetailSection } from './InterfaceDetailSection.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InterfaceData } from '../../../model/interface.js';

// ── Mocks ─────────────────────────────────────────────────

vi.mock('@monaco-editor/react', () => ({
    Editor: ({ value }: { value: string }) => (
        <textarea value={value} readOnly data-testid="monaco-editor" />
    ),
}));

vi.mock('../control-detail-section/ReadableJsonView.js', () => ({
    ReadableJsonView: ({ json }: { json?: object }) => (
        <div data-testid="readable-json-view">{json ? JSON.stringify(json) : 'No data'}</div>
    ),
}));

const mockFetchInterfaceVersions = vi.fn();
const mockFetchInterfaceForVersion = vi.fn();

vi.mock('../../../service/interface-service.js', () => ({
    InterfaceService: vi.fn().mockImplementation(() => ({
        fetchInterfaceVersions: (...args: unknown[]) => mockFetchInterfaceVersions(...args),
        fetchInterfaceForVersion: (...args: unknown[]) => mockFetchInterfaceForVersion(...args),
    })),
}));

// ── Test data ─────────────────────────────────────────────

const interfaceData: InterfaceData = {
    namespace: 'org.finos',
    interfaceId: 1,
    interfaceName: 'Payment API',
    interfaceDescription: 'Payment gateway interface',
};

const interfaceJson = { openapi: '3.0.0', info: { title: 'Payment API', version: '1.0.0' } };

// ── Helpers ───────────────────────────────────────────────

function setupMocks({
    versions = ['1.0.0'],
    json = interfaceJson,
}: {
    versions?: string[];
    json?: object;
} = {}) {
    mockFetchInterfaceVersions.mockResolvedValue(versions);
    mockFetchInterfaceForVersion.mockResolvedValue(json);
}

// ── Tests ─────────────────────────────────────────────────

describe('InterfaceDetailSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ──────────────────────────────────────────────────
    // Rendering
    // ──────────────────────────────────────────────────
    describe('rendering', () => {
        it('renders the breadcrumb header with interface name', async () => {
            setupMocks();
            render(<InterfaceDetailSection interfaceData={interfaceData} />);

            await waitFor(() => {
                const heading = screen.getByRole('heading');
                expect(heading).toHaveTextContent('Payment API');
            });
        });

        it('renders a readable JSON view by default', async () => {
            setupMocks();
            render(<InterfaceDetailSection interfaceData={interfaceData} />);

            await waitFor(() => {
                const readableView = screen.getByTestId('readable-json-view');
                expect(readableView).toBeInTheDocument();
            });
        });
    });

    // ──────────────────────────────────────────────────
    // useEffect: initial data loading
    // ──────────────────────────────────────────────────
    describe('initial data loading', () => {
        it('fetches interface versions on mount', async () => {
            setupMocks();
            render(<InterfaceDetailSection interfaceData={interfaceData} />);

            await waitFor(() => {
                expect(mockFetchInterfaceVersions).toHaveBeenCalledWith(
                    'org.finos',
                    1,
                );
            });
        });

        it('auto-selects the first version and fetches its JSON', async () => {
            setupMocks({ versions: ['1.0.0', '2.0.0'] });
            render(<InterfaceDetailSection interfaceData={interfaceData} />);

            await waitFor(() => {
                expect(mockFetchInterfaceForVersion).toHaveBeenCalledWith(
                    'org.finos',
                    1,
                    '1.0.0'
                );
            });
        });

        it('shows the auto-selected version in the breadcrumb', async () => {
            setupMocks({ versions: ['1.0.0'] });
            render(<InterfaceDetailSection interfaceData={interfaceData} />);

            await waitFor(() => {
                const heading = screen.getByRole('heading');
                expect(heading).toHaveTextContent('1.0.0');
            });
        });
    });

    // ──────────────────────────────────────────────────
    // Version tabs
    // ──────────────────────────────────────────────────
    describe('version tabs', () => {
        it('does not render version tabs when only one version exists', async () => {
            setupMocks({ versions: ['1.0.0'] });
            render(<InterfaceDetailSection interfaceData={interfaceData} />);

            await waitFor(() => {
                const tabs = screen.queryAllByRole('tab');
                const versionTabs = tabs.filter((t) => t.textContent === '1.0.0');
                expect(versionTabs).toHaveLength(0);
            });
        });

        it('renders version tabs when multiple versions exist', async () => {
            setupMocks({ versions: ['1.0.0', '2.0.0'] });
            render(<InterfaceDetailSection interfaceData={interfaceData} />);

            await waitFor(() => {
                expect(screen.getByRole('tab', { name: '1.0.0' })).toBeInTheDocument();
                expect(screen.getByRole('tab', { name: '2.0.0' })).toBeInTheDocument();
            });
        });

        it('fetches interface JSON when a version tab is clicked', async () => {
            setupMocks({ versions: ['1.0.0', '2.0.0'] });
            render(<InterfaceDetailSection interfaceData={interfaceData} />);

            await waitFor(() => {
                expect(screen.getByRole('tab', { name: '2.0.0' })).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('tab', { name: '2.0.0' }));

            await waitFor(() => {
                expect(mockFetchInterfaceForVersion).toHaveBeenCalledWith(
                    'org.finos',
                    1,
                    '2.0.0'
                );
            });
        });
    });

    // ──────────────────────────────────────────────────
    // View mode switching
    // ──────────────────────────────────────────────────
    describe('view mode switching', () => {
        it('switches to raw JSON view when Raw JSON tab is clicked', async () => {
            setupMocks();
            render(<InterfaceDetailSection interfaceData={interfaceData} />);

            await waitFor(() => {
                expect(screen.getByTestId('readable-json-view')).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('tab', { name: 'Raw JSON' }));

            await waitFor(() => {
                expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
            });
        });

        it('switches back to readable view when Readable tab is clicked', async () => {
            setupMocks();
            render(<InterfaceDetailSection interfaceData={interfaceData} />);

            await userEvent.click(screen.getByRole('tab', { name: 'Raw JSON' }));
            await waitFor(() => {
                expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
            });

            await userEvent.click(screen.getByRole('tab', { name: 'Readable' }));
            await waitFor(() => {
                expect(screen.getByTestId('readable-json-view')).toBeInTheDocument();
            });
        });
    });

    // ──────────────────────────────────────────────────
    // Interface change
    // ──────────────────────────────────────────────────
    describe('interface change', () => {
        it('resets state and refetches when interfaceData changes', async () => {
            setupMocks();
            const { rerender } = render(<InterfaceDetailSection interfaceData={interfaceData} />);

            await waitFor(() => {
                expect(mockFetchInterfaceVersions).toHaveBeenCalledWith('org.finos', 1);
            });

            const newInterfaceData: InterfaceData = {
                namespace: 'org.finos',
                interfaceId: 2,
                interfaceName: 'Auth API',
                interfaceDescription: 'Authentication interface',
            };

            setupMocks({ versions: ['0.1.0'] });
            rerender(<InterfaceDetailSection interfaceData={newInterfaceData} />);

            await waitFor(() => {
                expect(mockFetchInterfaceVersions).toHaveBeenCalledWith('org.finos', 2);
            });
        });
    });
});
