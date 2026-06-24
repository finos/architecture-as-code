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
            });
        });
    });
});
