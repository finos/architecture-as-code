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
        };
    }),
}));

const namespace = 'finos';

describe('useDefaultLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('unsupported types', () => {
        it.each(['Flows', 'ADRs', 'Standards'])(
            'never fetches and resolves to no default immediately for calmType %s',
            async (calmType) => {
                const { result } = renderHook(() => useDefaultLayout(namespace, 'test-id', calmType));
                expect(result.current.defaultLayout).toBeNull();
                expect(result.current.viewportKey).toBeUndefined();
                expect(result.current.canSave).toBe(false);
                expect(calmServiceMock.fetchMappings).not.toHaveBeenCalled();
                expect(layoutServiceMock.getDefaultLayout).not.toHaveBeenCalled();
            }
        );
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

            expect(result.current.viewportKey).toBe('finos/Architectures/5');
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

            await waitFor(() => expect(result.current.viewportKey).toBe('finos/Architectures/42'));
            expect(calmServiceMock.fetchMappings).toHaveBeenCalledWith(namespace, 'Architectures');
            expect(layoutServiceMock.getDefaultLayout).toHaveBeenCalledWith(namespace, 42, 'architectures');
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

            await waitFor(() => expect(viaSlug.result.current.viewportKey).toBe('finos/Architectures/42'));
            expect(viaNumeric.result.current.viewportKey).toBe('finos/Architectures/42');
            expect(viaSlug.result.current.viewportKey).toBe(viaNumeric.result.current.viewportKey);
        });

        it('resolves to no default and disables save when the slug cannot be resolved', async () => {
            calmServiceMock.fetchMappings.mockResolvedValue([]); // no matching mapping

            const { result } = renderHook(() => useDefaultLayout(namespace, 'unknown-slug', 'Architectures'));

            await waitFor(() => expect(result.current.defaultLayout).toBeNull());
            // null, not undefined: resolution settled for a real architecture with no
            // match, so the caller (Drawer) must not fall back to the raw slug — see
            // viewportKeyOverride's doc for why undefined and null mean different things.
            expect(result.current.viewportKey).toBeNull();
            expect(result.current.canSave).toBe(false);
            // Never attempted a layout fetch with an unresolved id.
            expect(layoutServiceMock.getDefaultLayout).not.toHaveBeenCalled();
        });

        it('resolves to no default when the mapping fetch itself fails', async () => {
            calmServiceMock.fetchMappings.mockRejectedValue(new Error('network error'));

            const { result } = renderHook(() => useDefaultLayout(namespace, 'unknown-slug', 'Architectures'));

            await waitFor(() => expect(result.current.defaultLayout).toBeNull());
            expect(result.current.canSave).toBe(false);
            // Same as an empty mapping list: a settled-but-unresolved rejection is
            // null, not undefined, so the slug fallback stays suppressed.
            expect(result.current.viewportKey).toBeNull();
        });

        it('keeps the viewportKey undefined (not null) while a slug is still resolving', async () => {
            let resolveMappings: (value: unknown[]) => void = () => {};
            calmServiceMock.fetchMappings.mockReturnValue(
                new Promise((resolve) => {
                    resolveMappings = resolve;
                })
            );

            const { result } = renderHook(() => useDefaultLayout(namespace, 'my-arch', 'Architectures'));

            // Still resolving: undefined signals "loading", distinct from null's
            // "settled, no match" — ArchitectureGraph's awaitingDefaultLayout gate
            // relies on this to avoid flashing the auto-layout mid-resolution.
            expect(result.current.viewportKey).toBeUndefined();
            expect(result.current.defaultLayout).toBeUndefined();

            await act(async () => {
                resolveMappings([]);
                await Promise.resolve();
            });

            await waitFor(() => expect(result.current.viewportKey).toBeNull());
        });
    });

    describe('save', () => {
        it('saves, clears the matching scratch entry, and bumps the epoch', async () => {
            layoutServiceMock.getDefaultLayout.mockResolvedValue(null);
            layoutServiceMock.saveDefaultLayout.mockResolvedValue(undefined);

            const { result } = renderHook(() => useDefaultLayout(namespace, '5', 'Architectures'));
            await waitFor(() => expect(result.current.defaultLayout).toBeNull());

            saveNodePositions('finos/Architectures/5', [{ id: 'node-a', position: { x: 1, y: 2 }, data: {} }] as never);
            expect(loadStoredNodePositions('finos/Architectures/5')).not.toBeNull();

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
                }),
                'architectures'
            );
            expect(result.current.defaultLayout).toEqual(positions);
            expect(result.current.layoutEpoch).toBe(1);
            expect(result.current.saving).toBe(false);
            expect(result.current.saveError).toBeNull();
            expect(loadStoredNodePositions('finos/Architectures/5')).toBeNull();
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
            await waitFor(() => expect(result.current.viewportKey).toBe('finos/Architectures/5'));

            saveNodePositions('finos/Architectures/5', [{ id: 'node-a', position: { x: 1, y: 2 }, data: {} }] as never);
            expect(loadStoredNodePositions('finos/Architectures/5')).not.toBeNull();

            act(() => {
                result.current.reset();
            });

            expect(result.current.layoutEpoch).toBe(1);
            expect(loadStoredNodePositions('finos/Architectures/5')).toBeNull();
        });

        it('does not touch a same-numbered pattern\'s scratch entry (collision regression)', async () => {
            // Architecture ids and pattern ids come from independent counters, so an
            // Architecture 5 and a Pattern 5 can coexist in the same namespace. Before
            // the calmType qualifier was added to the key, resetting one would have
            // cleared the other's scratch-position entry too.
            layoutServiceMock.getDefaultLayout.mockResolvedValue(null);

            const { result } = renderHook(() => useDefaultLayout(namespace, '5', 'Architectures'));
            await waitFor(() => expect(result.current.viewportKey).toBe('finos/Architectures/5'));

            const patternKey = 'finos/Patterns/5';
            saveNodePositions(patternKey, [{ id: 'node-a', position: { x: 9, y: 9 }, data: {} }] as never);
            expect(loadStoredNodePositions(patternKey)).not.toBeNull();

            act(() => {
                result.current.reset();
            });

            expect(loadStoredNodePositions(patternKey)).not.toBeNull();
        });
    });

    describe('patterns', () => {
        it('resolves the viewportKey for a numeric pattern id and fetches its layout', async () => {
            layoutServiceMock.getDefaultLayout.mockResolvedValue(null);

            const { result } = renderHook(() => useDefaultLayout(namespace, '9', 'Patterns'));

            await waitFor(() => expect(result.current.viewportKey).toBe('finos/Patterns/9'));
            expect(calmServiceMock.fetchMappings).not.toHaveBeenCalled();
            expect(layoutServiceMock.getDefaultLayout).toHaveBeenCalledWith(namespace, 9, 'patterns');
            expect(result.current.canSave).toBe(true);
        });

        it('resolves a slug pattern id via fetchMappings(namespace, Patterns)', async () => {
            // Asserts the actual argument passed, not just that the mock was called — a
            // hardcoded 'Architectures' here would silently resolve patterns against the
            // wrong mapping list.
            calmServiceMock.fetchMappings.mockResolvedValue([
                { namespace, customId: 'my-pattern', resourceType: 'Patterns', numericId: 9 },
            ]);
            layoutServiceMock.getDefaultLayout.mockResolvedValue(null);

            const { result } = renderHook(() => useDefaultLayout(namespace, 'my-pattern', 'Patterns'));

            await waitFor(() => expect(result.current.viewportKey).toBe('finos/Patterns/9'));
            expect(calmServiceMock.fetchMappings).toHaveBeenCalledWith(namespace, 'Patterns');
            expect(result.current.canSave).toBe(true);
        });

        it('save emits a /patterns/ for-target and PUTs via the patterns urlType', async () => {
            // The most likely bug to slip through: a stale hardcoded '/architectures/'
            // segment here would 400 against the backend's for-mismatch check on every
            // pattern save.
            layoutServiceMock.getDefaultLayout.mockResolvedValue(null);
            layoutServiceMock.saveDefaultLayout.mockResolvedValue(undefined);

            const { result } = renderHook(() => useDefaultLayout(namespace, '9', 'Patterns'));
            await waitFor(() => expect(result.current.defaultLayout).toBeNull());

            const positions = [{ id: 'node-a', position: { x: 1, y: 2 } }];
            await act(async () => {
                await result.current.save(positions);
            });

            expect(layoutServiceMock.saveDefaultLayout).toHaveBeenCalledWith(
                namespace,
                9,
                expect.objectContaining({
                    for: '/api/calm/namespaces/finos/patterns/9',
                    pins: [{ 'unique-id': 'node-a', position: { x: 1, y: 2 } }],
                }),
                'patterns'
            );
            expect(result.current.defaultLayout).toEqual(positions);
        });
    });
});
