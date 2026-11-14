import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ExtensionsContext, ExtensionsProvider } from './ExtensionsContext.js';
import { ExtensionRegistryError, ExtensionService } from '../service/extension-service.js';
import { ExtensionScreenPage } from './ExtensionScreenPage.js';
import { fakeExtension } from '../test-support/fake-extensions.js';

vi.mock('../components/navbar/Navbar.js', () => ({ Navbar: () => <nav>Navbar</nav> }));
afterEach(() => vi.restoreAllMocks());

const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <ExtensionsContext.Provider value={[fakeExtension(1)]}>
                <Routes>
                    <Route path="/extensions/:extensionId/:contributionId" element={<ExtensionScreenPage />} />
                </Routes>
            </ExtensionsContext.Provider>
        </MemoryRouter>
    );

it('loads a screen from route parameters', async () => {
    vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
    renderAt('/extensions/ext-1/screen');
    expect(await screen.findByRole('heading', { name: 'screen 1', level: 1 })).toBeInTheDocument();
});

it('says so for an unknown screen', () => {
    renderAt('/extensions/ext-1/nothing');
    expect(screen.getByText('Extension screen unavailable.')).toBeInTheDocument();
});

const renderWithRegistry = (fetchExtensions: Promise<ReturnType<typeof fakeExtension>[]>) => {
    const service = new ExtensionService();
    vi.spyOn(service, 'fetchExtensions').mockReturnValue(fetchExtensions);
    return render(
        <MemoryRouter initialEntries={['/extensions/ext-1/screen']}>
            <ExtensionsProvider service={service}>
                <Routes>
                    <Route path="/extensions/:extensionId/:contributionId" element={<ExtensionScreenPage />} />
                </Routes>
            </ExtensionsProvider>
        </MemoryRouter>
    );
};

it('shows a loading state, not "unavailable", until the registry loads', async () => {
    vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
    let complete: (value: ReturnType<typeof fakeExtension>[]) => void = () => {};
    renderWithRegistry(
        new Promise((resolve) => {
            complete = resolve;
        })
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading extension');
    expect(screen.queryByText('Extension screen unavailable.')).not.toBeInTheDocument();
    complete([fakeExtension(1)]);
    expect(await screen.findByRole('heading', { name: 'screen 1' })).toBeInTheDocument();
});

it('says so when the registry fails to load', async () => {
    renderWithRegistry(Promise.reject(new Error('down')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Extensions could not be loaded.');
    expect(screen.queryByText('Extension screen unavailable.')).not.toBeInTheDocument();
});

it('asks the user to sign in when the registry gives 401', async () => {
    renderWithRegistry(Promise.reject(new ExtensionRegistryError('Error fetching extensions', true)));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign in to see extensions.');
});

it('has an h1 while the registry loads', () => {
    renderWithRegistry(new Promise(() => {}));
    expect(screen.getByRole('heading', { level: 1, name: 'Extension screen' })).toBeInTheDocument();
});

it('has an h1 after the registry fails to load', async () => {
    renderWithRegistry(Promise.reject(new Error('down')));
    await screen.findByText('Extensions could not be loaded.');
    expect(screen.getByRole('heading', { level: 1, name: 'Extension screen' })).toBeInTheDocument();
});

it('keeps the screen h1 while the screen loads and after its request fails', async () => {
    let fail: (error: Error) => void = () => {};
    vi.spyOn(ExtensionService.prototype, 'call').mockReturnValue(new Promise((_, reject) => (fail = reject)));
    renderAt('/extensions/ext-1/screen');
    expect(screen.getByRole('status')).toHaveTextContent('Loading extension');
    expect(screen.getByRole('heading', { level: 1, name: 'screen 1' })).toBeInTheDocument();
    fail(new Error('down'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Extension request failed.');
    expect(screen.getByRole('heading', { level: 1, name: 'screen 1' })).toBeInTheDocument();
});

it('keeps the screen h1 when the reply cannot be shown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [{ type: 'table', columns: 'bad', rows: [] }] });
    renderAt('/extensions/ext-1/screen');
    expect(await screen.findByRole('alert')).toHaveTextContent('cannot show');
    expect(screen.getByRole('heading', { level: 1, name: 'screen 1' })).toBeInTheDocument();
});

it('keeps the contribution title as the h1 when the reply has its own title, and shows that title under it', async () => {
    vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, title: 'Releases this week', blocks: [] });
    renderAt('/extensions/ext-1/screen');
    expect(await screen.findByText('Releases this week')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('screen 1');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
});

it.each([
    ['the registry fails to load', () => renderWithRegistry(Promise.reject(new Error('down'))), 'Extension screen'],
    ['the screen is unknown', () => renderAt('/extensions/ext-1/nothing'), 'Extension screen'],
])('names the region that holds the h1 when %s', async (_name, renderPage, title) => {
    renderPage();
    const region = await screen.findByRole('region', { name: title });
    expect(region).toContainElement(screen.getByRole('heading', { level: 1, name: title }));
});

it('keeps the h1 in the named region when the reply cannot be shown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [{ type: 'table', columns: 'bad', rows: [] }] });
    renderAt('/extensions/ext-1/screen');
    const alert = await screen.findByRole('alert');
    const region = screen.getByRole('region', { name: 'screen 1' });
    expect(region).toContainElement(alert);
    expect(region).toContainElement(screen.getByRole('heading', { level: 1, name: 'screen 1' }));
});
