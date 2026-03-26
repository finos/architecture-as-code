import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    fetchDomains,
    fetchControlsForDomain,
    fetchRequirementVersions,
    fetchRequirementForVersion,
    fetchConfigurationsForControl,
    fetchConfigurationVersions,
    fetchConfigurationForVersion,
} from './control-service.js';

// Mock getAuthHeaders to return empty headers (auth disabled)
vi.mock('../authService.js', () => ({
    getAuthHeaders: vi.fn().mockResolvedValue({}),
}));

const domain = 'security';
const controlId = 1;
const configId = 10;
const version = '0.1.0';

function mockFetchSuccess(body: unknown) {
    return vi.fn().mockResolvedValue({
        json: () => Promise.resolve(body),
    });
}

function mockFetchFailure(message: string) {
    return vi.fn().mockRejectedValue(new Error(message));
}

describe('control-service', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    // ──────────────────────────────────────────────────
    // fetchDomains
    // ──────────────────────────────────────────────────
    describe('fetchDomains', () => {
        it('should call the correct endpoint and set domains from string values', async () => {
            const expected = ['security', 'compliance'];
            globalThis.fetch = mockFetchSuccess({ values: expected });

            const setter = vi.fn();
            await fetchDomains(setter);

            expect(globalThis.fetch).toHaveBeenCalledWith('/calm/domains', expect.objectContaining({ method: 'GET' }));
            expect(setter).toHaveBeenCalledWith(expected);
        });

        it('should handle an empty values array', async () => {
            globalThis.fetch = mockFetchSuccess({ values: [] });

            const setter = vi.fn();
            await fetchDomains(setter);

            expect(setter).toHaveBeenCalledWith([]);
        });

        it('should filter out non-string values', async () => {
            globalThis.fetch = mockFetchSuccess({ values: ['security', 42, null, 'compliance', undefined] });

            const setter = vi.fn();
            await fetchDomains(setter);

            expect(setter).toHaveBeenCalledWith(['security', 'compliance']);
        });

        it('should default to empty array when values is missing from response', async () => {
            globalThis.fetch = mockFetchSuccess({});

            const setter = vi.fn();
            await fetchDomains(setter);

            expect(setter).toHaveBeenCalledWith([]);
        });

        it('should not call setter on fetch error and log to console', async () => {
            globalThis.fetch = mockFetchFailure('Network error');
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const setter = vi.fn();
            await fetchDomains(setter);

            expect(setter).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith('Error fetching domains:', expect.any(Error));
        });
    });

    // ──────────────────────────────────────────────────
    // fetchControlsForDomain
    // ──────────────────────────────────────────────────
    describe('fetchControlsForDomain', () => {
        const expectedControls = [
            { id: 1, name: 'Access Control', description: 'Controls access' },
            { id: 2, name: 'Encryption', description: 'Data encryption standards' },
        ];

        it('should call the correct endpoint and set controls', async () => {
            globalThis.fetch = mockFetchSuccess({ values: expectedControls });

            const setter = vi.fn();
            await fetchControlsForDomain(domain, setter);

            expect(globalThis.fetch).toHaveBeenCalledWith(
                `/calm/domains/${domain}/controls`,
                expect.objectContaining({ method: 'GET' })
            );
            expect(setter).toHaveBeenCalledWith(expectedControls);
        });

        it('should handle an empty controls array', async () => {
            globalThis.fetch = mockFetchSuccess({ values: [] });

            const setter = vi.fn();
            await fetchControlsForDomain(domain, setter);

            expect(setter).toHaveBeenCalledWith([]);
        });

        it('should default to empty array when values is missing', async () => {
            globalThis.fetch = mockFetchSuccess({});

            const setter = vi.fn();
            await fetchControlsForDomain(domain, setter);

            expect(setter).toHaveBeenCalledWith([]);
        });

        it('should not call setter on fetch error and log to console', async () => {
            globalThis.fetch = mockFetchFailure('Network error');
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const setter = vi.fn();
            await fetchControlsForDomain(domain, setter);

            expect(setter).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error fetching controls'),
                expect.any(Error)
            );
        });
    });

    // ──────────────────────────────────────────────────
    // fetchRequirementVersions
    // ──────────────────────────────────────────────────
    describe('fetchRequirementVersions', () => {
        it('should call the correct endpoint and set versions', async () => {
            const expected = ['0.1.0', '0.2.0'];
            globalThis.fetch = mockFetchSuccess({ values: expected });

            const setter = vi.fn();
            await fetchRequirementVersions(domain, controlId, setter);

            expect(globalThis.fetch).toHaveBeenCalledWith(
                `/calm/domains/${domain}/controls/${controlId}/requirement/versions`,
                expect.objectContaining({ method: 'GET' })
            );
            expect(setter).toHaveBeenCalledWith(expected);
        });

        it('should handle an empty versions array', async () => {
            globalThis.fetch = mockFetchSuccess({ values: [] });

            const setter = vi.fn();
            await fetchRequirementVersions(domain, controlId, setter);

            expect(setter).toHaveBeenCalledWith([]);
        });

        it('should default to empty array when values is missing', async () => {
            globalThis.fetch = mockFetchSuccess({});

            const setter = vi.fn();
            await fetchRequirementVersions(domain, controlId, setter);

            expect(setter).toHaveBeenCalledWith([]);
        });

        it('should not call setter on fetch error and log to console', async () => {
            globalThis.fetch = mockFetchFailure('Network error');
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const setter = vi.fn();
            await fetchRequirementVersions(domain, controlId, setter);

            expect(setter).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error fetching requirement versions'),
                expect.any(Error)
            );
        });
    });

    // ──────────────────────────────────────────────────
    // fetchRequirementForVersion
    // ──────────────────────────────────────────────────
    describe('fetchRequirementForVersion', () => {
        const requirementSchema = { type: 'object', properties: { encrypted: { type: 'boolean' } } };

        it('should call the correct endpoint and return the requirement JSON', async () => {
            globalThis.fetch = mockFetchSuccess(requirementSchema);

            const result = await fetchRequirementForVersion(domain, controlId, version);

            expect(globalThis.fetch).toHaveBeenCalledWith(
                `/calm/domains/${domain}/controls/${controlId}/requirement/versions/${version}`,
                expect.objectContaining({ method: 'GET' })
            );
            expect(result).toEqual(requirementSchema);
        });

        it('should return undefined on fetch error and log to console', async () => {
            globalThis.fetch = mockFetchFailure('Network error');
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await fetchRequirementForVersion(domain, controlId, version);

            expect(result).toBeUndefined();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error fetching requirement version'),
                expect.any(Error)
            );
        });
    });

    // ──────────────────────────────────────────────────
    // fetchConfigurationsForControl
    // ──────────────────────────────────────────────────
    describe('fetchConfigurationsForControl', () => {
        it('should call the correct endpoint and set config IDs', async () => {
            const expected = [10, 20, 30];
            globalThis.fetch = mockFetchSuccess({ values: expected });

            const setter = vi.fn();
            await fetchConfigurationsForControl(domain, controlId, setter);

            expect(globalThis.fetch).toHaveBeenCalledWith(
                `/calm/domains/${domain}/controls/${controlId}/configurations`,
                expect.objectContaining({ method: 'GET' })
            );
            expect(setter).toHaveBeenCalledWith(expected);
        });

        it('should handle an empty configurations array', async () => {
            globalThis.fetch = mockFetchSuccess({ values: [] });

            const setter = vi.fn();
            await fetchConfigurationsForControl(domain, controlId, setter);

            expect(setter).toHaveBeenCalledWith([]);
        });

        it('should default to empty array when values is missing', async () => {
            globalThis.fetch = mockFetchSuccess({});

            const setter = vi.fn();
            await fetchConfigurationsForControl(domain, controlId, setter);

            expect(setter).toHaveBeenCalledWith([]);
        });

        it('should not call setter on fetch error and log to console', async () => {
            globalThis.fetch = mockFetchFailure('Network error');
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const setter = vi.fn();
            await fetchConfigurationsForControl(domain, controlId, setter);

            expect(setter).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error fetching configurations'),
                expect.any(Error)
            );
        });
    });

    // ──────────────────────────────────────────────────
    // fetchConfigurationVersions
    // ──────────────────────────────────────────────────
    describe('fetchConfigurationVersions', () => {
        it('should call the correct endpoint and set versions', async () => {
            const expected = ['1.0.0', '1.1.0'];
            globalThis.fetch = mockFetchSuccess({ values: expected });

            const setter = vi.fn();
            await fetchConfigurationVersions(domain, controlId, configId, setter);

            expect(globalThis.fetch).toHaveBeenCalledWith(
                `/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions`,
                expect.objectContaining({ method: 'GET' })
            );
            expect(setter).toHaveBeenCalledWith(expected);
        });

        it('should handle an empty versions array', async () => {
            globalThis.fetch = mockFetchSuccess({ values: [] });

            const setter = vi.fn();
            await fetchConfigurationVersions(domain, controlId, configId, setter);

            expect(setter).toHaveBeenCalledWith([]);
        });

        it('should default to empty array when values is missing', async () => {
            globalThis.fetch = mockFetchSuccess({});

            const setter = vi.fn();
            await fetchConfigurationVersions(domain, controlId, configId, setter);

            expect(setter).toHaveBeenCalledWith([]);
        });

        it('should not call setter on fetch error and log to console', async () => {
            globalThis.fetch = mockFetchFailure('Network error');
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const setter = vi.fn();
            await fetchConfigurationVersions(domain, controlId, configId, setter);

            expect(setter).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error fetching configuration versions'),
                expect.any(Error)
            );
        });
    });

    // ──────────────────────────────────────────────────
    // fetchConfigurationForVersion
    // ──────────────────────────────────────────────────
    describe('fetchConfigurationForVersion', () => {
        const configJson = { minKeyLength: 256, algorithm: 'AES' };

        it('should call the correct endpoint and return the configuration JSON', async () => {
            globalThis.fetch = mockFetchSuccess(configJson);

            const result = await fetchConfigurationForVersion(domain, controlId, configId, version);

            expect(globalThis.fetch).toHaveBeenCalledWith(
                `/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions/${version}`,
                expect.objectContaining({ method: 'GET' })
            );
            expect(result).toEqual(configJson);
        });

        it('should return undefined on fetch error and log to console', async () => {
            globalThis.fetch = mockFetchFailure('Network error');
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await fetchConfigurationForVersion(domain, controlId, configId, version);

            expect(result).toBeUndefined();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error fetching configuration version'),
                expect.any(Error)
            );
        });
    });
});
