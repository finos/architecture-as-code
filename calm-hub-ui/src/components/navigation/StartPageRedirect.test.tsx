import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionsContext, ExtensionsStatus, ExtensionsStatusContext } from '../../extensions/ExtensionsContext.js';
import { ExtensionSummary } from '../../model/extensions.js';
import { UiConfig } from '../../model/ui-config.js';
import { UI_CONFIG_WAIT_MS, UiConfigContext, UiConfigProvider } from '../ui-config/UiConfigContext.js';
import { UiConfigService } from '../../service/ui-config-service.js';
import { UiConfigStatus, UiConfigStatusContext } from '../ui-config/ui-config-status.js';
import { START_PAGE_WAIT_MS, StartPageRedirect } from './StartPageRedirect.js';
import { startPageTarget } from './start-page.js';

const REVIEWS: ExtensionSummary = {
    id: 'assurance',
    name: 'Assurance',
    hubApi: 0,
    routes: [],
    contributes: { screen: [{ id: 'reviews', title: 'Architecture reviews', route: 'list' }] },
};

const loaded = { configStatus: 'loaded', extensions: [REVIEWS], extensionsStatus: 'loaded', chatAvailable: false } as const;

describe('startPageTarget', () => {
    it('waits for the config', () => {
        expect(startPageTarget(undefined, { ...loaded, configStatus: 'loading' })).toBe('pending');
    });

    it('stays on the overview without a start page', () => {
        expect(startPageTarget(undefined, loaded)).toBeUndefined();
        expect(startPageTarget('/', loaded)).toBeUndefined();
    });

    it('opens a Hub page at once, even one whose navigation is hidden', () => {
        expect(startPageTarget('/namespace/finos', { ...loaded, extensionsStatus: 'loading' })).toBe('/namespace/finos');
    });

    it('waits for the registry before it opens an extension screen', () => {
        expect(startPageTarget('/extensions/assurance/reviews', { ...loaded, extensionsStatus: 'loading' })).toBe('pending');
        expect(startPageTarget('/extensions/assurance/reviews', loaded)).toBe('/extensions/assurance/reviews');
    });

    it.each<[string, string, Partial<Parameters<typeof startPageTarget>[1]>]>([
        ['an unknown screen', '/extensions/assurance/other', {}],
        ['a disabled extension', '/extensions/assurance/reviews', { extensions: [] }],
        ['a failed registry', '/extensions/assurance/reviews', { extensionsStatus: 'failed' }],
        ['a signed-out user', '/extensions/assurance/reviews', { extensionsStatus: 'signed-out' }],
    ])('falls back to the overview for %s', (_, path, state) => {
        expect(startPageTarget(path, { ...loaded, ...state })).toBeUndefined();
    });

    it('opens chat only when a provider is available', () => {
        expect(startPageTarget('/chat', loaded)).toBeUndefined();
        expect(startPageTarget('/chat', { ...loaded, chatAvailable: true })).toBe('/chat');
    });
});

/** As in App: the redirect wraps the routes. */
function PageRoutes() {
    return (
        <StartPageRedirect>
            <Routes>
                <Route path="/" element={<span>Overview</span>} />
                <Route path="*" element={<span>Other page</span>} />
            </Routes>
        </StartPageRedirect>
    );
}

function Probe() {
    return <span data-testid="path">{useLocation().pathname}</span>;
}

function renderAt(
    entries: Parameters<typeof MemoryRouter>[0]['initialEntries'],
    config: UiConfig,
    { configStatus = 'loaded', extensionsStatus = 'loaded' }: { configStatus?: UiConfigStatus; extensionsStatus?: ExtensionsStatus } = {}
) {
    const tree = (status: ExtensionsStatus) => (
        <UiConfigStatusContext.Provider value={configStatus}>
            <UiConfigContext.Provider value={config}>
                <ExtensionsStatusContext.Provider value={status}>
                    <ExtensionsContext.Provider value={status === 'loaded' ? [REVIEWS] : []}>
                        <MemoryRouter initialEntries={entries}>
                            <PageRoutes />
                            <Probe />
                        </MemoryRouter>
                    </ExtensionsContext.Provider>
                </ExtensionsStatusContext.Provider>
            </UiConfigContext.Provider>
        </UiConfigStatusContext.Provider>
    );
    const view = render(tree(extensionsStatus));
    return { ...view, setExtensionsStatus: (status: ExtensionsStatus) => view.rerender(tree(status)) };
}

const startAt = (startPage: string): UiConfig => ({ navigation: { layout: 'menu', showNamespaces: true, showControlDomains: true, startPage } });

describe('StartPageRedirect', () => {
    it('opens the start page when Hub opens on /', async () => {
        renderAt(['/'], startAt('/extensions/assurance/reviews'));

        expect(await screen.findByText('Other page')).toBeInTheDocument();
        expect(screen.getByTestId('path')).toHaveTextContent('/extensions/assurance/reviews');
    });

    it('shows nothing until the registry says whether the screen exists, then falls back once', () => {
        const view = renderAt(['/'], startAt('/extensions/assurance/reviews'), { extensionsStatus: 'loading' });
        expect(screen.queryByText('Overview')).not.toBeInTheDocument();

        view.setExtensionsStatus('failed');
        expect(screen.getByText('Overview')).toBeInTheDocument();

        // A retry that succeeds later must not move the user away from the page they have.
        view.setExtensionsStatus('loaded');
        expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/);
    });

    it('shows the overview on a later visit to /, such as the Home link', () => {
        renderAt([{ pathname: '/', key: 'home-link' }], startAt('/namespace/finos'));

        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/);
    });

    it('renders a deep link at once, before the config loads', () => {
        renderAt(['/namespace/finos'], {}, { configStatus: 'loading' });

        expect(screen.getByText('Other page')).toBeInTheDocument();
    });

    it('waits for the config before it shows the overview', () => {
        renderAt(['/'], {}, { configStatus: 'loading' });

        expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    });
    describe('when a request does not settle', () => {
        afterEach(() => vi.useRealTimers());

        it('shows the overview after the wait for the config, and a late start page does not move the user', async () => {
            vi.useFakeTimers();
            let reply: (config: UiConfig) => void = () => {};
            const service = { getUiConfig: () => new Promise<UiConfig>((resolve) => (reply = resolve)) } as unknown as UiConfigService;
            render(
                <UiConfigProvider service={service}>
                    <ExtensionsContext.Provider value={[REVIEWS]}>
                        <MemoryRouter initialEntries={['/']}>
                            <PageRoutes />
                            <Probe />
                        </MemoryRouter>
                    </ExtensionsContext.Provider>
                </UiConfigProvider>
            );
            expect(screen.queryByText('Overview')).not.toBeInTheDocument();

            act(() => vi.advanceTimersByTime(UI_CONFIG_WAIT_MS));
            expect(screen.getByText('Overview')).toBeInTheDocument();

            await act(async () => reply(startAt('/extensions/assurance/reviews')));
            expect(screen.getByText('Overview')).toBeInTheDocument();
            expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/);
        });

        it('shows the overview after the wait for the registry, and a late registry does not move the user', () => {
            vi.useFakeTimers();
            const view = renderAt(['/'], startAt('/extensions/assurance/reviews'), { extensionsStatus: 'loading' });
            act(() => vi.advanceTimersByTime(START_PAGE_WAIT_MS - 1));
            expect(screen.queryByText('Overview')).not.toBeInTheDocument();

            act(() => vi.advanceTimersByTime(1));
            expect(screen.getByText('Overview')).toBeInTheDocument();

            view.setExtensionsStatus('loaded');
            expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/);
        });
    });
});
