import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePatternImplementations } from './usePatternImplementations.js';
import type { PatternImplementationService } from '../../../../service/pattern-implementation-service.js';
import type { PatternImplementation } from '../../../../model/pattern-implementation.js';

const implementation: PatternImplementation = { namespace: 'finos', architectureId: 3, version: '1.0.0' };

function serviceReturning(fetchImplementations: PatternImplementationService['fetchImplementations']) {
    return { fetchImplementations: vi.fn(fetchImplementations) } as unknown as PatternImplementationService & {
        fetchImplementations: ReturnType<typeof vi.fn>;
    };
}

interface Props {
    patternName?: string;
    version?: string;
    requested?: boolean;
}

function renderLookup(service: PatternImplementationService, initial: Props = {}) {
    return renderHook(
        ({ patternName = 'api-gateway', version = '1.0.0', requested = true }: Props) =>
            usePatternImplementations(service, 'finos', patternName, version, requested),
        { initialProps: initial }
    );
}

describe('usePatternImplementations', () => {
    it('stays idle and does not ask until requested', () => {
        const service = serviceReturning(() => Promise.resolve([implementation]));
        const { result } = renderLookup(service, { requested: false });
        expect(result.current).toEqual({ status: 'idle' });
        expect(service.fetchImplementations).not.toHaveBeenCalled();
    });

    it('is unavailable for a pattern with no name', () => {
        const service = serviceReturning(() => Promise.resolve([implementation]));
        const { result } = renderHook(() => usePatternImplementations(service, 'finos', undefined, '1.0.0', true));
        expect(result.current).toEqual({ status: 'unavailable' });
        expect(service.fetchImplementations).not.toHaveBeenCalled();
    });

    it('reports loading, then the implementations, from one request', async () => {
        const service = serviceReturning(() => Promise.resolve([implementation]));
        const { result } = renderLookup(service);
        expect(result.current).toEqual({ status: 'loading' });

        await waitFor(() => expect(result.current).toEqual({ status: 'loaded', implementations: [implementation] }));
        expect(service.fetchImplementations).toHaveBeenCalledTimes(1);
        expect(service.fetchImplementations).toHaveBeenCalledWith('finos', 'api-gateway', '1.0.0');
    });

    it('is unavailable when the hub does not support the lookup', async () => {
        const service = serviceReturning(() => Promise.resolve(null));
        const { result } = renderLookup(service);
        await waitFor(() => expect(result.current).toEqual({ status: 'unavailable' }));
    });

    it('keeps a response when the tab closes, but asks again after an error', async () => {
        const service = serviceReturning(() => Promise.reject(new Error('boom')));
        const { result, rerender } = renderLookup(service);
        await waitFor(() => expect(result.current).toEqual({ status: 'error' }));

        rerender({ requested: false });
        expect(result.current).toEqual({ status: 'idle' });

        service.fetchImplementations.mockResolvedValue([implementation]);
        rerender({ requested: true });
        await waitFor(() => expect(result.current).toEqual({ status: 'loaded', implementations: [implementation] }));

        rerender({ requested: false });
        expect(result.current).toEqual({ status: 'loaded', implementations: [implementation] });
        expect(service.fetchImplementations).toHaveBeenCalledTimes(2);
    });

    it('asks again for another version and ignores the earlier response', async () => {
        let resolveFirst: (value: PatternImplementation[]) => void = () => undefined;
        const service = serviceReturning((_ns, _name, version) =>
            version === '1.0.0'
                ? new Promise((resolve) => { resolveFirst = resolve; })
                : Promise.resolve([{ ...implementation, version: '2.0.0' }])
        );
        const { result, rerender } = renderLookup(service);

        rerender({ version: '2.0.0' });
        await waitFor(() =>
            expect(result.current).toEqual({ status: 'loaded', implementations: [{ ...implementation, version: '2.0.0' }] })
        );

        await act(async () => resolveFirst([implementation]));
        expect(result.current).toEqual({ status: 'loaded', implementations: [{ ...implementation, version: '2.0.0' }] });
    });
});
