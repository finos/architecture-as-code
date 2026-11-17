import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.js';
import { UI_CONFIG_WAIT_MS } from './components/ui-config/UiConfigContext.js';
import { START_PAGE_WAIT_MS } from './components/navigation/StartPageRedirect.js';
import { ExtensionSummary } from './model/extensions.js';
import { UiConfig } from './model/ui-config.js';

const backend = vi.hoisted(() => ({ config: Promise.resolve({}) as Promise<unknown>, extensions: Promise.resolve([]) as Promise<unknown> }));

vi.mock('./service/ui-config-service.js', () => ({
    UiConfigService: class {
        getUiConfig() {
            return backend.config;
        }
    },
}));
vi.mock('./service/extension-service.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./service/extension-service.js')>()),
    ExtensionService: class {
        fetchExtensions() {
            return backend.extensions;
        }
    },
}));
vi.mock('./service/user-access-service.js', () => ({
    UserAccessService: class {
        getCurrentUserAccess() {
            return Promise.resolve([]);
        }
    },
}));

// Each page shows its path and links to a namespace and to Home, so a test can move through the real routes.
vi.mock('./hub/Hub.js', async () => {
    const { Link, useLocation } = await import('react-router-dom');
    return {
        default: function FakeHub() {
            return (
                <>
                    <span data-testid="page">{useLocation().pathname}</span>
                    <Link to="/namespace/finos">finos</Link>
                    <Link to="/">Home</Link>
                </>
            );
        },
    };
});
vi.mock('./extensions/ExtensionScreenPage.js', async () => {
    const { useLocation } = await import('react-router-dom');
    return {
        ExtensionScreenPage: function FakeScreen() {
            return <span data-testid="page">{useLocation().pathname}</span>;
        },
    };
});

const REVIEWS: ExtensionSummary = {
    id: 'assurance',
    name: 'Assurance',
    hubApi: 0,
    routes: [],
    contributes: { screen: [{ id: 'reviews', title: 'Architecture reviews', route: 'list' }] },
};

const startAt = (startPage: string): UiConfig => ({ navigation: { layout: 'menu', showNamespaces: true, showControlDomains: true, startPage } });

function deferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((done) => (resolve = done));
    return { promise, resolve };
}

/** Back to the entry that opened Hub, then a moment for a redirect that must not come. jsdom goes back in a task. */
async function backToTheFirstEntry() {
    const from = window.location.hash;
    await act(async () => window.history.back());
    await waitFor(() => expect(window.location.hash).not.toBe(from));
    await act(() => new Promise((done) => setTimeout(done, 50)));
    expect(window.location.hash).toBe('');
    expect(screen.getByTestId('page')).toHaveTextContent(/^\/$/);
}

describe('App start page', () => {
    beforeEach(() => {
        // The first entry of a session has no history state, so react-router gives it the `default` key.
        window.history.replaceState(null, '', '/');
        backend.config = Promise.resolve({});
        backend.extensions = Promise.resolve([]);
    });

    afterEach(() => vi.useRealTimers());

    it('opens the start page at once when the config names one', async () => {
        backend.config = Promise.resolve(startAt('/namespace/configured'));
        render(<App />);

        expect(await screen.findByTestId('page')).toHaveTextContent('/namespace/configured');
    });

    it('keeps a deep link, and shows the overview on a Home visit', async () => {
        window.history.replaceState(null, '', '/#/namespace/finos');
        backend.config = Promise.resolve(startAt('/namespace/configured'));
        render(<App />);
        expect(await screen.findByTestId('page')).toHaveTextContent('/namespace/finos');

        await userEvent.click(screen.getByRole('link', { name: 'Home' }));
        await act(() => new Promise((done) => setTimeout(done, 50)));
        expect(screen.getByTestId('page')).toHaveTextContent(/^\/$/);
    });

    it('stays on the overview after a late config, also when Back returns to it from another page', async () => {
        vi.useFakeTimers();
        const config = deferred<UiConfig>();
        backend.config = config.promise;
        render(<App />);
        await act(() => vi.advanceTimersByTimeAsync(UI_CONFIG_WAIT_MS - 1));
        expect(screen.queryByTestId('page')).not.toBeInTheDocument();
        await act(() => vi.advanceTimersByTimeAsync(1));
        expect(screen.getByTestId('page')).toHaveTextContent(/^\/$/);

        await act(async () => config.resolve(startAt('/namespace/configured')));
        vi.useRealTimers();
        expect(screen.getByTestId('page')).toHaveTextContent(/^\/$/);

        await userEvent.click(screen.getByRole('link', { name: 'finos' }));
        expect(screen.getByTestId('page')).toHaveTextContent('/namespace/finos');
        await backToTheFirstEntry();
    });

    it('stays on the overview after a late registry, also when Back returns to it from another page', async () => {
        vi.useFakeTimers();
        const extensions = deferred<ExtensionSummary[]>();
        backend.config = Promise.resolve(startAt('/extensions/assurance/reviews'));
        backend.extensions = extensions.promise;
        render(<App />);
        await act(() => vi.advanceTimersByTimeAsync(START_PAGE_WAIT_MS - 1));
        expect(screen.queryByTestId('page')).not.toBeInTheDocument();
        await act(() => vi.advanceTimersByTimeAsync(1));
        expect(screen.getByTestId('page')).toHaveTextContent(/^\/$/);

        await act(async () => extensions.resolve([REVIEWS]));
        vi.useRealTimers();
        expect(screen.getByTestId('page')).toHaveTextContent(/^\/$/);

        await userEvent.click(screen.getByRole('link', { name: 'finos' }));
        expect(screen.getByTestId('page')).toHaveTextContent('/namespace/finos');
        await backToTheFirstEntry();
    });
});
