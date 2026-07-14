import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useResourceFromRoute } from './useResourceFromRoute.js';
import * as loaders from '../components/tree-navigation/navigation-loaders.js';

const fetchInterfacesForNamespace = vi.fn();
const fetchControlsForDomain = vi.fn();

vi.mock('../../service/calm-service.js', () => ({ CalmService: vi.fn().mockImplementation(function () { return {}; }) }));
vi.mock('../../service/adr-service/adr-service.js', () => ({ AdrService: vi.fn().mockImplementation(function () { return {}; }) }));
vi.mock('../../service/interface-service.js', () => ({
    InterfaceService: vi.fn().mockImplementation(function () { return { fetchInterfacesForNamespace }; }),
}));
vi.mock('../../service/control-service.js', () => ({
    ControlService: vi.fn().mockImplementation(function () { return { fetchControlsForDomain }; }),
}));

const callbacks = {
    onDataLoad: vi.fn(),
    onAdrLoad: vi.fn(),
    onControlLoad: vi.fn(),
    onInterfaceLoad: vi.fn(),
    onLoadError: vi.fn(),
};

function Harness() {
    useResourceFromRoute(callbacks);
    return null;
}

const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/" element={<Harness />} />
                <Route path="/:namespace/:type/:id/:version" element={<Harness />} />
            </Routes>
        </MemoryRouter>
    );

beforeEach(() => {
    vi.clearAllMocks();
    fetchInterfacesForNamespace.mockResolvedValue([]);
    fetchControlsForDomain.mockResolvedValue([]);
});

describe('useResourceFromRoute', () => {
    it('does nothing on a non-detail route', () => {
        const loadResource = vi.spyOn(loaders, 'loadResource');
        renderAt('/');
        expect(loadResource).not.toHaveBeenCalled();
        expect(callbacks.onDataLoad).not.toHaveBeenCalled();
    });

    it('loads a numeric architecture resource via loadResource', async () => {
        const loadResource = vi.spyOn(loaders, 'loadResource').mockImplementation(() => {});
        renderAt('/traderx/architectures/1/1.0.0');
        await waitFor(() => {
            expect(loadResource).toHaveBeenCalledWith(
                expect.objectContaining({ version: '1.0.0', type: 'Architectures', namespace: 'traderx', resourceID: '1' })
            );
        });
        loadResource.mockRestore();
    });

    it('loads a slug resource via loadResourceForId', async () => {
        const loadResourceForId = vi.spyOn(loaders, 'loadResourceForId').mockImplementation(() => {});
        renderAt('/traderx/architectures/my-arch/1.0.0');
        await waitFor(() => {
            expect(loadResourceForId).toHaveBeenCalledWith(
                '1.0.0',
                'Architectures',
                'traderx',
                'my-arch',
                expect.anything(),
                expect.any(Function),
                expect.any(Function)
            );
        });
        loadResourceForId.mockRestore();
    });

    it('loads an interface via onInterfaceLoad when the id matches', async () => {
        fetchInterfacesForNamespace.mockResolvedValue([{ id: 7, name: 'My Interface', description: 'desc' }]);
        renderAt('/traderx/interfaces/7/detail');
        await waitFor(() => {
            expect(callbacks.onInterfaceLoad).toHaveBeenCalledWith({
                namespace: 'traderx',
                interfaceId: 7,
                interfaceName: 'My Interface',
                interfaceDescription: 'desc',
            });
        });
    });

    it('loads a control via onControlLoad when the id matches', async () => {
        fetchControlsForDomain.mockResolvedValue([{ id: 5, name: 'Encryption', description: 'desc' }]);
        renderAt('/security/controls/5/detail');
        await waitFor(() => {
            expect(callbacks.onControlLoad).toHaveBeenCalledWith({
                domain: 'security',
                controlId: 5,
                controlName: 'Encryption',
                controlDescription: 'desc',
                controlTitle: undefined,
            });
        });
    });

    it('loads a control by name slug (search deep-link) and passes the title', async () => {
        fetchControlsForDomain.mockResolvedValue([
            { id: 5, name: 'encryption-at-rest', description: 'desc', title: 'Encryption at rest' },
        ]);
        renderAt('/security/controls/encryption-at-rest/detail');
        await waitFor(() => {
            expect(callbacks.onControlLoad).toHaveBeenCalledWith({
                domain: 'security',
                controlId: 5,
                controlName: 'encryption-at-rest',
                controlDescription: 'desc',
                controlTitle: 'Encryption at rest',
            });
        });
    });
});

describe('useResourceFromRoute — load failures', () => {
    it('reports a failed slug load through onLoadError', async () => {
        vi.spyOn(loaders, 'loadResourceForId').mockImplementation(
            (_version, _type, _ns, _id, _svc, _onData, onError) => {
                onError?.(new Error('404'));
            }
        );
        renderAt('/finos/architectures/model-registry/1.0.0');
        await waitFor(() => expect(callbacks.onLoadError).toHaveBeenCalled());
        expect(callbacks.onDataLoad).not.toHaveBeenCalled();
    });

    it('reports a failed numeric-id load through onLoadError', async () => {
        vi.spyOn(loaders, 'loadResource').mockImplementation(({ onError }) => {
            onError?.(new Error('404'));
        });
        renderAt('/finos/architectures/42/1.0.0');
        await waitFor(() => expect(callbacks.onLoadError).toHaveBeenCalled());
        expect(callbacks.onDataLoad).not.toHaveBeenCalled();
    });
});

describe('useResourceFromRoute — stale results after navigation', () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    it('drops a late numeric-id success that resolves after cleanup', async () => {
        let emitData: ((data: unknown) => void) | undefined;
        vi.spyOn(loaders, 'loadResource').mockImplementation(({ onDataLoad }) => {
            emitData = onDataLoad as (data: unknown) => void;
        });
        const { unmount } = renderAt('/finos/architectures/42/1.0.0');
        await waitFor(() => expect(emitData).toBeDefined());

        unmount();
        emitData!({ id: 'stale' });

        expect(callbacks.onDataLoad).not.toHaveBeenCalled();
    });

    it('drops a late slug success that resolves after cleanup', async () => {
        let emitData: ((data: unknown) => void) | undefined;
        vi.spyOn(loaders, 'loadResourceForId').mockImplementation(
            (_version, _type, _ns, _id, _svc, onData) => {
                emitData = onData as (data: unknown) => void;
            }
        );
        const { unmount } = renderAt('/finos/architectures/my-arch/1.0.0');
        await waitFor(() => expect(emitData).toBeDefined());

        unmount();
        emitData!({ id: 'stale' });

        expect(callbacks.onDataLoad).not.toHaveBeenCalled();
    });

    it('drops a late interface success that resolves after cleanup', async () => {
        let resolveInterfaces: (value: unknown) => void = () => undefined;
        fetchInterfacesForNamespace.mockReturnValue(new Promise((resolve) => { resolveInterfaces = resolve; }));
        const { unmount } = renderAt('/traderx/interfaces/7/detail');

        unmount();
        resolveInterfaces([{ id: 7, name: 'My Interface', description: 'desc' }]);
        await flush();

        expect(callbacks.onInterfaceLoad).not.toHaveBeenCalled();
    });

    it('drops a late control success that resolves after cleanup', async () => {
        let resolveControls: (value: unknown) => void = () => undefined;
        fetchControlsForDomain.mockReturnValue(new Promise((resolve) => { resolveControls = resolve; }));
        const { unmount } = renderAt('/security/controls/5/detail');

        unmount();
        resolveControls([{ id: 5, name: 'Encryption', description: 'desc' }]);
        await flush();

        expect(callbacks.onControlLoad).not.toHaveBeenCalled();
    });
});
