import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ControlDetailSection } from './ControlDetailSection.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ControlData } from '../../../model/control.js';

// ── Mocks ─────────────────────────────────────────────────

vi.mock('@monaco-editor/react', () => ({
    Editor: ({ value }: { value: string }) => (
        <textarea value={value} readOnly data-testid="monaco-editor" />
    ),
}));

vi.mock('./ReadableJsonView.js', () => ({
    ReadableJsonView: ({ json }: { json?: object }) => (
        <div data-testid="readable-json-view">{json ? JSON.stringify(json) : 'No data'}</div>
    ),
}));

const mockFetchRequirementVersions = vi.fn();
const mockFetchRequirementForVersion = vi.fn();
const mockFetchConfigurationsForControl = vi.fn();
const mockFetchConfigurationVersions = vi.fn();
const mockFetchConfigurationForVersion = vi.fn();

vi.mock('../../../service/control-service.js', () => ({
    ControlService: vi.fn().mockImplementation(() => ({
        fetchRequirementVersions: (...args: unknown[]) => mockFetchRequirementVersions(...args),
        fetchRequirementForVersion: (...args: unknown[]) => mockFetchRequirementForVersion(...args),
        fetchConfigurationsForControl: (...args: unknown[]) => mockFetchConfigurationsForControl(...args),
        fetchConfigurationVersions: (...args: unknown[]) => mockFetchConfigurationVersions(...args),
        fetchConfigurationForVersion: (...args: unknown[]) => mockFetchConfigurationForVersion(...args),
    })),
}));

// ── Test data ─────────────────────────────────────────────

const controlData: ControlData = {
    domain: 'security',
    controlId: 1,
    controlName: 'Access Control',
    controlDescription: 'Controls access to resources',
};

const requirementSchema = { type: 'object', properties: { role: { type: 'string' } } };
const configJson = { minKeyLength: 256, algorithm: 'AES' };

// ── Helpers ───────────────────────────────────────────────

/**
 * Sets up the mocks so that:
 * - fetchRequirementVersions resolves with the given versions
 * - fetchRequirementForVersion resolves to the given schema
 * - fetchConfigurationsForControl resolves with the given config IDs
 * - fetchConfigurationVersions resolves with the given versions
 * - fetchConfigurationForVersion resolves to the given JSON
 */
function setupMocks({
    reqVersions = ['0.1.0'],
    reqSchema = requirementSchema,
    configIds = [10],
    cfgVersions = ['1.0.0'],
    cfgJson = configJson,
}: {
    reqVersions?: string[];
    reqSchema?: object;
    configIds?: number[];
    cfgVersions?: string[];
    cfgJson?: object;
} = {}) {
    mockFetchRequirementVersions.mockResolvedValue(reqVersions);
    mockFetchRequirementForVersion.mockResolvedValue(reqSchema);
    mockFetchConfigurationsForControl.mockResolvedValue(configIds);
    mockFetchConfigurationVersions.mockResolvedValue(cfgVersions);
    mockFetchConfigurationForVersion.mockResolvedValue(cfgJson);
}

// ── Tests ─────────────────────────────────────────────────

describe('ControlDetailSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ──────────────────────────────────────────────────
    // Rendering
    // ──────────────────────────────────────────────────
    describe('rendering', () => {
        it('renders the requirement breadcrumb header with control name', async () => {
            setupMocks();
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                const headings = screen.getAllByRole('heading');
                const reqHeading = headings[0];

                expect(reqHeading).toHaveTextContent('Access Control');
                expect(reqHeading).toHaveTextContent('Requirement');
            });
        });

        it('renders the configuration breadcrumb header with control name', async () => {
            setupMocks();
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                const headings = screen.getAllByRole('heading');
                const cfgHeading = headings[1];

                expect(cfgHeading).toHaveTextContent('Access Control');
                expect(cfgHeading).toHaveTextContent('Configurations');
            });
        });

        it('shows "No configurations" when no config IDs exist', async () => {
            setupMocks({ configIds: [] });
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                expect(screen.getByText('No configurations')).toBeInTheDocument();
            });
        });

        it('renders two readable JSON views by default (requirement + configuration)', async () => {
            setupMocks();
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                const readableViews = screen.getAllByTestId('readable-json-view');
                expect(readableViews).toHaveLength(2);
            });
        });
    });

    // ──────────────────────────────────────────────────
    // useEffect: initial data loading
    // ──────────────────────────────────────────────────
    describe('initial data loading', () => {
        it('fetches requirement versions and configurations on mount', async () => {
            setupMocks();
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                expect(mockFetchRequirementVersions).toHaveBeenCalledWith(
                    'security',
                    1,
                );
                expect(mockFetchConfigurationsForControl).toHaveBeenCalledWith(
                    'security',
                    1,
                );
            });
        });

        it('auto-selects the first requirement version and fetches its schema', async () => {
            setupMocks({ reqVersions: ['0.1.0', '0.2.0'] });
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                expect(mockFetchRequirementForVersion).toHaveBeenCalledWith(
                    'security',
                    1,
                    '0.1.0'
                );
            });
        });

        it('shows the auto-selected requirement version in the breadcrumb', async () => {
            setupMocks({ reqVersions: ['0.1.0'] });
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                const headings = screen.getAllByRole('heading');
                expect(headings[0]).toHaveTextContent('0.1.0');
            });
        });
    });

    // ──────────────────────────────────────────────────
    // Requirement version tabs
    // ──────────────────────────────────────────────────
    describe('requirement version tabs', () => {
        it('does not render version tabs when only one version exists', async () => {
            setupMocks({ reqVersions: ['0.1.0'] });
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                // The version tab bar only renders when > 1 version
                const tabs = screen.queryAllByRole('tab');
                // Only config tabs may be present (for config IDs), not requirement version tabs
                const reqVersionTabs = tabs.filter((t) => t.textContent === '0.1.0');
                // With auto-select, '0.1.0' should NOT appear as a clickable tab since there's only 1 version
                expect(reqVersionTabs).toHaveLength(0);
            });
        });

        it('renders version tabs when multiple requirement versions exist', async () => {
            setupMocks({ reqVersions: ['0.1.0', '0.2.0'] });
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                expect(screen.getByRole('tab', { name: '0.1.0' })).toBeInTheDocument();
                expect(screen.getByRole('tab', { name: '0.2.0' })).toBeInTheDocument();
            });
        });

        it('applies active style to the selected requirement version tab', async () => {
            setupMocks({ reqVersions: ['0.1.0', '0.2.0'] });
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                const activeTab = screen.getByRole('tab', { name: '0.1.0' });
                expect(activeTab).toHaveClass('tab-active');

                const inactiveTab = screen.getByRole('tab', { name: '0.2.0' });
                expect(inactiveTab).not.toHaveClass('tab-active');
            });
        });

        it('switches requirement version when a different tab is clicked', async () => {
            setupMocks({ reqVersions: ['0.1.0', '0.2.0'] });
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                expect(screen.getByRole('tab', { name: '0.2.0' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('tab', { name: '0.2.0' }));

            expect(mockFetchRequirementForVersion).toHaveBeenCalledWith(
                'security',
                1,
                '0.2.0'
            );

            const newActiveTab = screen.getByRole('tab', { name: '0.2.0' });
            expect(newActiveTab).toHaveClass('tab-active');
        });
    });

    // ──────────────────────────────────────────────────
    // Configuration tabs
    // ──────────────────────────────────────────────────
    describe('configuration tabs', () => {
        it('renders config ID tabs', async () => {
            setupMocks({ configIds: [10, 20] });
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                expect(screen.getByRole('tab', { name: 'Config 10' })).toBeInTheDocument();
                expect(screen.getByRole('tab', { name: 'Config 20' })).toBeInTheDocument();
            });
        });

        it('clicking a config ID tab fetches its versions', async () => {
            setupMocks({ configIds: [10, 20] });
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            await user.click(await screen.findByRole('tab', { name: 'Config 10' }));

            expect(mockFetchConfigurationVersions).toHaveBeenCalledWith(
                'security',
                1,
                10,
            );
        });

        it('applies active style to the selected config tab', async () => {
            setupMocks({ configIds: [10, 20] });
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            await user.click(await screen.findByRole('tab', { name: 'Config 10' }));

            expect(screen.getByRole('tab', { name: 'Config 10' })).toHaveClass('tab-active');
            expect(screen.getByRole('tab', { name: 'Config 20' })).not.toHaveClass('tab-active');
        });

        it('shows the selected config ID in the breadcrumb header', async () => {
            setupMocks({ configIds: [10] });
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            await user.click(await screen.findByRole('tab', { name: 'Config 10' }));

            const headings = screen.getAllByRole('heading');
            expect(headings[1]).toHaveTextContent('10');
        });

        it('renders config version tabs after selecting a config ID', async () => {
            setupMocks({ configIds: [10], cfgVersions: ['1.0.0', '1.1.0'] });
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            await user.click(await screen.findByRole('tab', { name: 'Config 10' }));

            await waitFor(() => {
                expect(screen.getByRole('tab', { name: '1.0.0' })).toBeInTheDocument();
                expect(screen.getByRole('tab', { name: '1.1.0' })).toBeInTheDocument();
            });
        });

        it('clicking a config version tab fetches the configuration JSON', async () => {
            setupMocks({ configIds: [10], cfgVersions: ['1.0.0'] });
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            await user.click(await screen.findByRole('tab', { name: 'Config 10' }));

            await waitFor(() => {
                expect(screen.getByRole('tab', { name: '1.0.0' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('tab', { name: '1.0.0' }));

            expect(mockFetchConfigurationForVersion).toHaveBeenCalledWith(
                'security',
                1,
                10,
                '1.0.0'
            );
        });

        it('applies active style to the selected config version tab', async () => {
            setupMocks({ configIds: [10], cfgVersions: ['1.0.0', '1.1.0'] });
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            await user.click(await screen.findByRole('tab', { name: 'Config 10' }));
            await waitFor(() => {
                expect(screen.getByRole('tab', { name: '1.0.0' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('tab', { name: '1.0.0' }));

            expect(screen.getByRole('tab', { name: '1.0.0' })).toHaveClass('tab-active');
            expect(screen.getByRole('tab', { name: '1.1.0' })).not.toHaveClass('tab-active');
        });

        it('shows the selected config version in the breadcrumb header', async () => {
            setupMocks({ configIds: [10], cfgVersions: ['1.0.0'] });
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            await user.click(await screen.findByRole('tab', { name: 'Config 10' }));
            await waitFor(() => {
                expect(screen.getByRole('tab', { name: '1.0.0' })).toBeInTheDocument();
            });
            await user.click(screen.getByRole('tab', { name: '1.0.0' }));

            const headings = screen.getAllByRole('heading');
            expect(headings[1]).toHaveTextContent('1.0.0');
        });

        it('does not show config version tabs until a config ID is selected', async () => {
            setupMocks({ configIds: [10], cfgVersions: ['1.0.0'] });
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                // Config version tabs should not be present until Config 10 is clicked
                expect(screen.queryByRole('tab', { name: '1.0.0' })).not.toBeInTheDocument();
            });
        });
    });

    // ──────────────────────────────────────────────────
    // View mode toggle (Readable / Raw JSON)
    // ──────────────────────────────────────────────────
    describe('view mode toggle', () => {
        it('defaults to Readable view for requirement panel', async () => {
            setupMocks();
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                const readableViews = screen.getAllByTestId('readable-json-view');
                expect(readableViews.length).toBeGreaterThanOrEqual(1);
            });

            // Raw JSON renderer should not be visible by default
            expect(document.querySelectorAll('[data-cy="json-renderer-wrapper"]')).toHaveLength(0);
        });

        it('switches requirement panel to Raw JSON view when Raw JSON tab is clicked', async () => {
            setupMocks();
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            // Find the Raw JSON tabs — there are two, one per panel
            const rawTabs = await screen.findAllByRole('tab', { name: 'Raw JSON' });
            await user.click(rawTabs[0]); // click requirement panel's Raw JSON tab

            // Requirement panel should now show JsonRenderer
            await waitFor(() => {
                const wrappers = document.querySelectorAll('[data-cy="json-renderer-wrapper"]');
                expect(wrappers).toHaveLength(1);
            });
        });

        it('switches configuration panel to Raw JSON view independently', async () => {
            setupMocks();
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            const rawTabs = await screen.findAllByRole('tab', { name: 'Raw JSON' });
            await user.click(rawTabs[1]); // click config panel's Raw JSON tab

            await waitFor(() => {
                // One json-renderer-wrapper (config panel) + one readable-json-view (req panel)
                const wrappers = document.querySelectorAll('[data-cy="json-renderer-wrapper"]');
                expect(wrappers).toHaveLength(1);
                const readableViews = screen.getAllByTestId('readable-json-view');
                expect(readableViews).toHaveLength(1);
            });
        });

        it('can toggle back from Raw JSON to Readable', async () => {
            setupMocks();
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            const rawTabs = await screen.findAllByRole('tab', { name: 'Raw JSON' });
            await user.click(rawTabs[0]);

            await waitFor(() => {
                expect(document.querySelectorAll('[data-cy="json-renderer-wrapper"]')).toHaveLength(1);
            });

            const readableTabs = screen.getAllByRole('tab', { name: 'Readable' });
            await user.click(readableTabs[0]);

            await waitFor(() => {
                expect(document.querySelectorAll('[data-cy="json-renderer-wrapper"]')).toHaveLength(0);
                expect(screen.getAllByTestId('readable-json-view')).toHaveLength(2);
            });
        });
    });

    // ──────────────────────────────────────────────────
    // State reset on prop change
    // ──────────────────────────────────────────────────
    describe('state reset on prop change', () => {
        it('re-fetches data when controlData changes', async () => {
            setupMocks();
            const { rerender } = render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                expect(mockFetchRequirementVersions).toHaveBeenCalledTimes(1);
                expect(mockFetchConfigurationsForControl).toHaveBeenCalledTimes(1);
            });

            const newControl: ControlData = {
                domain: 'compliance',
                controlId: 2,
                controlName: 'Encryption',
                controlDescription: 'Data encryption standards',
            };

            rerender(<ControlDetailSection controlData={newControl} />);

            await waitFor(() => {
                expect(mockFetchRequirementVersions).toHaveBeenCalledTimes(2);
                expect(mockFetchRequirementVersions).toHaveBeenLastCalledWith(
                    'compliance',
                    2,
                );
                expect(mockFetchConfigurationsForControl).toHaveBeenCalledTimes(2);
                expect(mockFetchConfigurationsForControl).toHaveBeenLastCalledWith(
                    'compliance',
                    2,
                );
            });
        });

        it('updates the breadcrumb header when controlData changes', async () => {
            setupMocks();
            const { rerender } = render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                const headings = screen.getAllByRole('heading');
                expect(headings[0]).toHaveTextContent('Access Control');
            });

            const newControl: ControlData = {
                domain: 'compliance',
                controlId: 2,
                controlName: 'Encryption',
                controlDescription: 'Data encryption standards',
            };

            rerender(<ControlDetailSection controlData={newControl} />);

            await waitFor(() => {
                const updatedHeadings = screen.getAllByRole('heading');
                expect(updatedHeadings[0]).toHaveTextContent('Encryption');
            });
        });
    });
});
