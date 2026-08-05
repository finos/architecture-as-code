import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDefaultLayout } from './useDefaultLayout.js';
import { saveNodePositions, loadStoredNodePositions } from '../../visualizer/services/node-position-service.js';

const calmServiceMock = {
    fetchMappings: vi.fn(),
};

const layoutServiceMock = {
    getDefaultLayout: vi.fn(),
    saveDefaultLayout: vi.fn(),
    deleteDefaultLayout: vi.fn(),
};

vi.mock('../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(function () {
        return { fetchMappings: calmServiceMock.fetchMappings };
    }),
}));

vi.mock('../../service/layout-service.js', () => ({
    LayoutService: vi.fn().mockImplementation(function () {
        return {
            getDefaultLayout: layoutServiceMock.getDefaultLayout,
            saveDefaultLayout: layoutServiceMock.saveDefaultLayout,
            deleteDefaultLayout: layoutServiceMock.deleteDefaultLayout,
        };
    }),
}));

const namespace = 'finos';

describe('useDefaultLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('non-architectures', () => {
        it('never fetches and resolves to no default immediately', async () => {
            const { result } = renderHook(() => useDefaultLayout(namespace, 'test-pattern', 'Patterns'));
            expect(result.current.defaultLayout).toBeNull();
            expect(result.current.viewportKey).toBeUndefined();
            expect(result.current.canSave).toBe(false);
            expect(calmServiceMock.fetchMappings).not.toHaveBeenCalled();
            expect(layoutServiceMock.getDefaultLayout).not.toHaveBeenCalled();
        });
    });

    describe('numeric id', () => {
        it('resolves the viewportKey immediately, without a mapping lookup', () => {
            layoutServiceMock.getDefaultLayout.mockResolvedValue(null);
            renderHook(() => useDefaultLayout(namespace, '5', 'Architectures'));
            expect(calmServiceMock.fetchMappings).not.toHaveBeenCalled();
        });

        it('fetches and exposes the saved default layout', async () => {
            layoutServiceMock.getDefaultLayout.mockResolvedValue({
                for: `/api/calm/namespaces/${namespace}/architectures/5`,
                pins: [{ 'unique-id': 'node-a', position: { x: 10, y: 20 } }],
            });
            const { result } = renderHook(() => useDefaultLayout(namespace, '5', 'Architectures'));

            expect(result.current.defaultLayout).toBeUndefined(); // loading
            await waitFor(() => expect(result.current.defaultLayout).not.toBeUndefined());

            expect(result.current.viewportKey).toBe('finos/5');
            expect(result.current.defaultLayout).toEqual([{ id: 'node-a', position: { x: 10, y: 20 } }]);
            expect(result.current.canSave).toBe(true);
        });

        it('resolves to null when no default has been saved', async () => {
            layoutServiceMock.getDefaultLayout.mockResolvedValue(null);
            const { result } = renderHook(() => useDefaultLayout(namespace, '5', 'Architectures'));
            await waitFor(() => expect(result.current.defaultLayout).toBeNull());
        });
    });

    describe('slug id', () => {
        it('resolves via fetchMappings and keys the viewport off the numeric id', async () => {
            calmServiceMock.fetchMappings.mockResolvedValue([
                { namespace, customId: 'my-arch', resourceType: 'Architectures', numericId: 42 },
            ]);
            layoutServiceMock.getDefaultLayout.mockResolvedValue(null);

            const { result } = renderHook(() => useDefaultLayout(namespace, 'my-arch', 'Architectures'));

            await waitFor(() => expect(result.current.viewportKey).toBe('finos/42'));
            expect(calmServiceMock.fetchMappings).toHaveBeenCalledWith(namespace, 'Architectures');
            expect(layoutServiceMock.getDefaultLayout).toHaveBeenCalledWith(namespace, 42);
            expect(result.current.canSave).toBe(true);
        });

        it('resolves to the same viewportKey as the numeric route for the same architecture', async () => {
            // The precedence-safety property: whether the user arrives via
            // /finos/architectures/my-arch/... or /finos/architectures/42/...,
            // both must key the scratch layer and the server call identically —
            // otherwise a drag saved under one route silently doesn't apply
            // under the other. See Drawer.tsx's `viewportKeyOverride`.
            calmServiceMock.fetchMappings.mockResolvedValue([
                { namespace, customId: 'my-arch', resourceType: 'Architectures', numericId: 42 },
            ]);
            layoutServiceMock.getDefaultLayout.mockResolvedValue(null);

            const viaSlug = renderHook(() => useDefaultLayout(namespace, 'my-arch', 'Architectures'));
            const viaNumeric = renderHook(() => useDefaultLayout(namespace, '42', 'Architectures'));

            await waitFor(() => expect(viaSlug.result.current.viewportKey).toBe('finos/42'));
            expect(viaNumeric.result.current.viewportKey).toBe('finos/42');
            expect(viaSlug.result.current.viewportKey).toBe(viaNumeric.result.current.viewportKey);
        });

        it('resolves to no default and disables save when the slug cannot be resolved', async () => {
            calmServiceMock.fetchMappings.mockResolvedValue([]); // no matching mapping

            const { result } = renderHook(() => useDefaultLayout(namespace, 'unknown-slug', 'Architectures'));

            await waitFor(() => expect(result.current.defaultLayout).toBeNull());
            expect(result.current.viewportKey).toBeUndefined();
            expect(result.current.canSave).toBe(false);
            // Never attempted a layout fetch with an unresolved id.
            expect(layoutServiceMock.getDefaultLayout).not.toHaveBeenCalled();
        });

        it('resolves to no default when the mapping fetch itself fails', async () => {
            calmServiceMock.fetchMappings.mockRejectedValue(new Error('network error'));

            const { result } = renderHook(() => useDefaultLayout(namespace, 'unknown-slug', 'Architectures'));

            await waitFor(() => expect(result.current.defaultLayout).toBeNull());
            expect(result.current.canSave).toBe(false);
        });
    });

    describe('save', () => {
        it('saves, clears the matching scratch entry, and bumps the epoch', async () => {
            layoutServiceMock.getDefaultLayout.mockResolvedValue(null);
            layoutServiceMock.saveDefaultLayout.mockResolvedValue(undefined);

            const { result } = renderHook(() => useDefaultLayout(namespace, '5', 'Architectures'));
            await waitFor(() => expect(result.current.defaultLayout).toBeNull());

            saveNodePositions('finos/5', [{ id: 'node-a', position: { x: 1, y: 2 }, data: {} }] as never);
            expect(loadStoredNodePositions('finos/5')).not.toBeNull();

            const positions = [{ id: 'node-a', position: { x: 1, y: 2 } }];
            await act(async () => {
                await result.current.save(positions);
            });

            expect(layoutServiceMock.saveDefaultLayout).toHaveBeenCalledWith(
                namespace,
                5,
                expect.objectContaining({
                    for: '/api/calm/namespaces/finos/architectures/5',
                    pins: [{ 'unique-id': 'node-a', position: { x: 1, y: 2 } }],
                })
            );
            expect(result.current.defaultLayout).toEqual(positions);
            expect(result.current.layoutEpoch).toBe(1);
            expect(result.current.saving).toBe(false);
            expect(result.current.saveError).toBeNull();
            expect(loadStoredNodePositions('finos/5')).toBeNull();
        });

        it('surfaces an error and leaves state otherwise unchanged on failure', async () => {
            layoutServiceMock.getDefaultLayout.mockResolvedValue(null);
            layoutServiceMock.saveDefaultLayout.mockRejectedValue(new Error('boom'));

            const { result } = renderHook(() => useDefaultLayout(namespace, '5', 'Architectures'));
            await waitFor(() => expect(result.current.defaultLayout).toBeNull());

            await act(async () => {
                await expect(result.current.save([{ id: 'node-a', position: { x: 0, y: 0 } }])).rejects.toThrow();
            });

            expect(result.current.saveError).toBe('boom');
            expect(result.current.saving).toBe(false);
            expect(result.current.layoutEpoch).toBe(0);
        });

        it('is a no-op while the architecture id has not resolved', async () => {
            calmServiceMock.fetchMappings.mockResolvedValue([]);
            const { result } = renderHook(() => useDefaultLayout(namespace, 'unresolvable', 'Architectures'));
            await waitFor(() => expect(result.current.canSave).toBe(false));

            await act(async () => {
                await result.current.save([{ id: 'node-a', position: { x: 0, y: 0 } }]);
            });

            expect(layoutServiceMock.saveDefaultLayout).not.toHaveBeenCalled();
        });
    });

    describe('reset', () => {
        it('clears the scratch entry for the current viewportKey and bumps the epoch', async () => {
            layoutServiceMock.getDefaultLayout.mockResolvedValue(null);

            const { result } = renderHook(() => useDefaultLayout(namespace, '5', 'Architectures'));
            await waitFor(() => expect(result.current.viewportKey).toBe('finos/5'));

            saveNodePositions('finos/5', [{ id: 'node-a', position: { x: 1, y: 2 }, data: {} }] as never);
            expect(loadStoredNodePositions('finos/5')).not.toBeNull();

            act(() => {
                result.current.reset();
            });

            expect(result.current.layoutEpoch).toBe(1);
            expect(loadStoredNodePositions('finos/5')).toBeNull();
        });
    });
});
