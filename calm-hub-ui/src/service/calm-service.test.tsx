import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchDecoratorValues } from './calm-service.js';

vi.mock('../authService.js', () => ({
    getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer test-token' }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeFetchResponse(body: unknown, ok = true) {
    return Promise.resolve({
        ok,
        json: () => Promise.resolve(body),
    } as Response);
}

describe('fetchDecoratorValues', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns decorator values from the response', async () => {
        const decorators = [
            { uniqueId: 'dec-1', type: 'deployment', data: { status: 'completed' } },
        ];
        mockFetch.mockReturnValue(makeFetchResponse({ values: decorators }));

        const result = await fetchDecoratorValues('my-namespace');

        expect(result).toEqual(decorators);
    });

    it('calls the correct endpoint for a namespace', async () => {
        mockFetch.mockReturnValue(makeFetchResponse({ values: [] }));

        await fetchDecoratorValues('my-namespace');

        expect(mockFetch).toHaveBeenCalledWith(
            '/calm/namespaces/my-namespace/decorators/values',
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('encodes the namespace in the URL', async () => {
        mockFetch.mockReturnValue(makeFetchResponse({ values: [] }));

        await fetchDecoratorValues('my namespace/with special chars');

        const calledUrl = mockFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain('my%20namespace%2Fwith%20special%20chars');
    });

    it('appends target query param when provided', async () => {
        mockFetch.mockReturnValue(makeFetchResponse({ values: [] }));

        await fetchDecoratorValues('ns', '/calm/namespaces/ns/architectures/arch/versions/1-0-0');

        const calledUrl = mockFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain('target=%2Fcalm%2Fnamespaces%2Fns%2Farchitectures%2Farch%2Fversions%2F1-0-0');
    });

    it('appends type query param when provided', async () => {
        mockFetch.mockReturnValue(makeFetchResponse({ values: [] }));

        await fetchDecoratorValues('ns', undefined, 'deployment');

        const calledUrl = mockFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain('type=deployment');
    });

    it('appends both target and type when both are provided', async () => {
        mockFetch.mockReturnValue(makeFetchResponse({ values: [] }));

        await fetchDecoratorValues('ns', '/some/target', 'deployment');

        const calledUrl = mockFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain('target=');
        expect(calledUrl).toContain('type=deployment');
    });

    it('returns empty array when response has no values field', async () => {
        mockFetch.mockReturnValue(makeFetchResponse({}));

        const result = await fetchDecoratorValues('ns');

        expect(result).toEqual([]);
    });

    it('returns empty array and does not throw when fetch fails', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const result = await fetchDecoratorValues('ns');

        expect(result).toEqual([]);
    });
});
