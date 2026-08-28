import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ControlDetailSection } from './ControlDetailSection.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ControlConfigDetail, ControlData } from '../../../model/control.js';

// ── Mocks ─────────────────────────────────────────────────

vi.mock('@monaco-editor/react', () => ({
    Editor: ({ value }: { value: string }) => (
        <textarea value={value} readOnly data-testid="monaco-editor" />
    ),
}));

vi.mock('./ReadableControlDoc.js', () => ({
    ReadableControlDoc: ({ doc }: { doc?: object }) => (
        <div data-testid="readable-json-view">{doc ? JSON.stringify(doc) : 'No data'}</div>
    ),
}));

const mockFetchRequirementVersions = vi.fn();
const mockFetchRequirementForVersion = vi.fn();
const mockFetchConfigurationsForControl = vi.fn();
const mockFetchConfigurationVersions = vi.fn();
const mockFetchConfigurationForVersion = vi.fn();

vi.mock('../../../service/control-service.js', () => ({
    ControlService: vi.fn().mockImplementation(function () { return {
        fetchRequirementVersions: (...args: unknown[]) => mockFetchRequirementVersions(...args),
        fetchRequirementForVersion: (...args: unknown[]) => mockFetchRequirementForVersion(...args),
        fetchConfigurationsForControl: (...args: unknown[]) => mockFetchConfigurationsForControl(...args),
        fetchConfigurationVersions: (...args: unknown[]) => mockFetchConfigurationVersions(...args),
        fetchConfigurationForVersion: (...args: unknown[]) => mockFetchConfigurationForVersion(...args),
    }; }),
}));

/** Force `useIsMobile()` to report the given viewport. Returns a restore fn. */
function mockViewport(isMobile: boolean) {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
        matches: isMobile,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    return () => {
        window.matchMedia = original;
    };
}

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

function setupMocks({
    reqVersions = ['0.1.0'],
    reqSchema = requirementSchema,
    configs = [{ id: 10 }] as ControlConfigDetail[],
    cfgVersions = ['1.0.0'],
    cfgJson = configJson,
}: {
    reqVersions?: string[];
    reqSchema?: object;
    configs?: ControlConfigDetail[];
    cfgVersions?: string[];
    cfgJson?: object;
} = {}) {
    mockFetchRequirementVersions.mockResolvedValue(reqVersions);
    mockFetchRequirementForVersion.mockResolvedValue(reqSchema);
    mockFetchConfigurationsForControl.mockResolvedValue(configs);
    mockFetchConfigurationVersions.mockResolvedValue(cfgVersions);
    mockFetchConfigurationForVersion.mockResolvedValue(cfgJson);
}

// ── Tests ─────────────────────────────────────────────────

describe('ControlDetailSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ──────────────────────────────────────────────────
    // Desktop: side-by-side columns
    // ──────────────────────────────────────────────────
    describe('desktop layout', () => {
        it('renders Requirement and Configuration columns side by side', async () => {
            setupMocks();
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                expect(screen.getByText('Requirement')).toBeInTheDocument();
                expect(screen.getByText('Configuration')).toBeInTheDocument();
            });
            // Both panels render at once (not tabbed).
            expect(screen.getAllByTestId('readable-json-view')).toHaveLength(2);
        });

        it('shows only the Requirement column when there are no configurations', async () => {
            setupMocks({ configs: [] });
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                expect(screen.getByText('Requirement')).toBeInTheDocument();
            });
            expect(screen.queryByText('Configuration')).not.toBeInTheDocument();
            expect(screen.getAllByTestId('readable-json-view')).toHaveLength(1);
        });

        it('renders an independent readable/raw toggle per column', async () => {
            setupMocks();
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() =>
                expect(screen.getAllByRole('tab', { name: 'Raw JSON' })).toHaveLength(2),
            );

            // Flip only the requirement column to raw.
            await user.click(screen.getAllByRole('tab', { name: 'Raw JSON' })[0]);
            await waitFor(() => {
                expect(document.querySelectorAll('[data-cy="json-renderer-wrapper"]')).toHaveLength(1);
                expect(screen.getAllByTestId('readable-json-view')).toHaveLength(1);
            });
        });

        it('hides the per-column toggles when viewMode is controlled by the parent', async () => {
            setupMocks();
            render(<ControlDetailSection controlData={controlData} viewMode="raw" />);

            await waitFor(() => {
                expect(document.querySelectorAll('[data-cy="json-renderer-wrapper"]')).toHaveLength(2);
            });
            expect(screen.queryByRole('tab', { name: 'Readable' })).not.toBeInTheDocument();
        });
    });

    // ──────────────────────────────────────────────────
    // Mobile: Requirement / Configuration tabs
    // ──────────────────────────────────────────────────
    describe('mobile layout', () => {
        let restore: () => void;
        beforeEach(() => { restore = mockViewport(true); });
        afterEach(() => { restore(); });

        it('renders the two sections as tabs, one panel at a time', async () => {
            setupMocks();
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                expect(screen.getByRole('tab', { name: 'Requirement' })).toBeInTheDocument();
                expect(screen.getByRole('tab', { name: 'Configuration' })).toBeInTheDocument();
            });
            expect(screen.getAllByTestId('readable-json-view')).toHaveLength(1);
        });

        it('omits the Configuration tab when there are no configurations', async () => {
            setupMocks({ configs: [] });
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                expect(screen.getByRole('tab', { name: 'Requirement' })).toBeInTheDocument();
            });
            expect(screen.queryByRole('tab', { name: 'Configuration' })).not.toBeInTheDocument();
        });

        it('switches to the Configuration panel when its tab is clicked', async () => {
            setupMocks({ cfgJson: configJson });
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            const reqTab = await screen.findByRole('tab', { name: 'Requirement' });
            expect(reqTab).toHaveClass('tab-active');

            await user.click(screen.getByRole('tab', { name: 'Configuration' }));
            expect(screen.getByRole('tab', { name: 'Configuration' })).toHaveClass('tab-active');
            expect(screen.getByTestId('readable-json-view')).toHaveTextContent(JSON.stringify(configJson));
        });
    });

    // ──────────────────────────────────────────────────
    // Initial data loading (viewport-independent)
    // ──────────────────────────────────────────────────
    describe('initial data loading', () => {
        it('fetches requirement versions and configurations on mount', async () => {
            setupMocks();
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                expect(mockFetchRequirementVersions).toHaveBeenCalledWith('security', 1);
                expect(mockFetchConfigurationsForControl).toHaveBeenCalledWith('security', 1);
            });
        });

        it('auto-selects the first requirement version and fetches its schema', async () => {
            setupMocks({ reqVersions: ['0.1.0', '0.2.0'] });
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                expect(mockFetchRequirementForVersion).toHaveBeenCalledWith('security', 1, '0.1.0');
            });
        });

        it('auto-loads a lone configuration and its lone version', async () => {
            setupMocks({ configs: [{ id: 10 }], cfgVersions: ['1.0.0'] });
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => {
                expect(mockFetchConfigurationVersions).toHaveBeenCalledWith('security', 1, 10);
                expect(mockFetchConfigurationForVersion).toHaveBeenCalledWith('security', 1, 10, '1.0.0');
            });
        });
    });

    // ──────────────────────────────────────────────────
    // Requirement version picker
    // ──────────────────────────────────────────────────
    describe('requirement version picker', () => {
        it('does not render a picker when only one version exists', async () => {
            setupMocks({ reqVersions: ['0.1.0'] });
            render(<ControlDetailSection controlData={controlData} />);

            await waitFor(() => expect(screen.getByText('Requirement')).toBeInTheDocument());
            expect(screen.queryByLabelText('Requirement version')).not.toBeInTheDocument();
        });

        it('renders a dropdown with an option per version when several exist', async () => {
            setupMocks({ reqVersions: ['0.1.0', '0.2.0'] });
            render(<ControlDetailSection controlData={controlData} />);

            const select = await screen.findByLabelText('Requirement version');
            expect(select).toHaveValue('0.1.0');
            expect(screen.getByRole('option', { name: '0.1.0' })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: '0.2.0' })).toBeInTheDocument();
        });

        it('fetches the chosen version and updates the selection', async () => {
            setupMocks({ reqVersions: ['0.1.0', '0.2.0'] });
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            const select = await screen.findByLabelText('Requirement version');
            await user.selectOptions(select, '0.2.0');

            expect(mockFetchRequirementForVersion).toHaveBeenCalledWith('security', 1, '0.2.0');
            expect(select).toHaveValue('0.2.0');
        });
    });

    // ──────────────────────────────────────────────────
    // Configuration picker (in the Configuration column on desktop)
    // ──────────────────────────────────────────────────
    describe('configuration picker', () => {
        it('labels options using title then name then a fallback', async () => {
            setupMocks({ configs: [
                { id: 10, title: 'Rate Limit Config' },
                { id: 20, name: 'config-b' },
                { id: 30 },
            ]});
            render(<ControlDetailSection controlData={controlData} />);

            const select = await screen.findByLabelText('Configuration');
            expect(select).toBeInTheDocument();
            expect(screen.getByRole('option', { name: 'Rate Limit Config' })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: 'config-b' })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: 'Config 30' })).toBeInTheDocument();
        });

        it('fetches versions for the chosen configuration', async () => {
            setupMocks({ configs: [{ id: 10 }, { id: 20 }] });
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            const select = await screen.findByLabelText('Configuration');
            await user.selectOptions(select, '20');

            expect(mockFetchConfigurationVersions).toHaveBeenCalledWith('security', 1, 20);
        });

        it('does not render a version picker until a configuration with several versions is chosen', async () => {
            setupMocks({ configs: [{ id: 10 }, { id: 20 }], cfgVersions: ['1.0.0', '1.1.0'] });
            const user = userEvent.setup();
            render(<ControlDetailSection controlData={controlData} />);

            await screen.findByLabelText('Configuration');
            expect(screen.queryByLabelText('Configuration version')).not.toBeInTheDocument();

            await user.selectOptions(screen.getByLabelText('Configuration'), '10');

            const versionSelect = await screen.findByLabelText('Configuration version');
            expect(screen.getByRole('option', { name: '1.0.0' })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: '1.1.0' })).toBeInTheDocument();

            await user.selectOptions(versionSelect, '1.1.0');
            expect(mockFetchConfigurationForVersion).toHaveBeenCalledWith('security', 1, 10, '1.1.0');
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
                expect(mockFetchRequirementVersions).toHaveBeenLastCalledWith('compliance', 2);
                expect(mockFetchConfigurationsForControl).toHaveBeenCalledTimes(2);
                expect(mockFetchConfigurationsForControl).toHaveBeenLastCalledWith('compliance', 2);
            });
        });
    });
});
