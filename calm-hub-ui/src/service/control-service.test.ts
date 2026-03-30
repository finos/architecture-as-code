import { describe, it, expect, afterEach } from 'vitest';
import AxiosMockAdapter from 'axios-mock-adapter';
import { ControlService } from './control-service.js';
import axios from 'axios';

const ax = axios.create();
const mock = new AxiosMockAdapter(ax as never);

const domain = 'security';
const controlId = 1;
const configId = 10;
const version = '0.1.0';

describe('ControlService', () => {
    const controlService = new ControlService(ax);

    afterEach(() => {
        mock.reset();
    });

    // ──────────────────────────────────────────────────
    // fetchDomains
    // ──────────────────────────────────────────────────
    describe('fetchDomains', () => {
        it('should call the correct endpoint and return domains from string values', async () => {
            const expected = ['security', 'compliance'];
            mock.onGet('/calm/domains').reply(200, { values: expected });

            const result = await controlService.fetchDomains();
            expect(result).toEqual(expected);
        });

        it('should handle an empty values array', async () => {
            mock.onGet('/calm/domains').reply(200, { values: [] });

            const result = await controlService.fetchDomains();
            expect(result).toEqual([]);
        });

        it('should filter out non-string values', async () => {
            mock.onGet('/calm/domains').reply(200, { values: ['security', 42, null, 'compliance', undefined] });

            const result = await controlService.fetchDomains();
            expect(result).toEqual(['security', 'compliance']);
        });

        it('should default to empty array when values is missing from response', async () => {
            mock.onGet('/calm/domains').reply(200, {});

            const result = await controlService.fetchDomains();
            expect(result).toEqual([]);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet('/calm/domains').reply(500, { message: 'Error' });

            await expect(controlService.fetchDomains()).rejects.toThrowError();
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

        it('should call the correct endpoint and return controls', async () => {
            mock.onGet(`/calm/domains/${domain}/controls`).reply(200, { values: expectedControls });

            const result = await controlService.fetchControlsForDomain(domain);
            expect(result).toEqual(expectedControls);
        });

        it('should handle an empty controls array', async () => {
            mock.onGet(`/calm/domains/${domain}/controls`).reply(200, { values: [] });

            const result = await controlService.fetchControlsForDomain(domain);
            expect(result).toEqual([]);
        });

        it('should default to empty array when values is missing', async () => {
            mock.onGet(`/calm/domains/${domain}/controls`).reply(200, {});

            const result = await controlService.fetchControlsForDomain(domain);
            expect(result).toEqual([]);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/domains/${domain}/controls`).reply(500, { message: 'Error' });

            await expect(controlService.fetchControlsForDomain(domain)).rejects.toThrowError();
        });
    });

    // ──────────────────────────────────────────────────
    // fetchRequirementVersions
    // ──────────────────────────────────────────────────
    describe('fetchRequirementVersions', () => {
        it('should call the correct endpoint and return versions', async () => {
            const expected = ['0.1.0', '0.2.0'];
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/requirement/versions`).reply(200, { values: expected });

            const result = await controlService.fetchRequirementVersions(domain, controlId);
            expect(result).toEqual(expected);
        });

        it('should handle an empty versions array', async () => {
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/requirement/versions`).reply(200, { values: [] });

            const result = await controlService.fetchRequirementVersions(domain, controlId);
            expect(result).toEqual([]);
        });

        it('should default to empty array when values is missing', async () => {
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/requirement/versions`).reply(200, {});

            const result = await controlService.fetchRequirementVersions(domain, controlId);
            expect(result).toEqual([]);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/requirement/versions`).reply(500, { message: 'Error' });

            await expect(controlService.fetchRequirementVersions(domain, controlId)).rejects.toThrowError();
        });
    });

    // ──────────────────────────────────────────────────
    // fetchRequirementForVersion
    // ──────────────────────────────────────────────────
    describe('fetchRequirementForVersion', () => {
        const requirementSchema = { type: 'object', properties: { encrypted: { type: 'boolean' } } };

        it('should call the correct endpoint and return the requirement JSON', async () => {
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/requirement/versions/${version}`).reply(200, requirementSchema);

            const result = await controlService.fetchRequirementForVersion(domain, controlId, version);
            expect(result).toEqual(requirementSchema);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/requirement/versions/${version}`).reply(500, { message: 'Error' });

            await expect(controlService.fetchRequirementForVersion(domain, controlId, version)).rejects.toThrowError();
        });
    });

    // ──────────────────────────────────────────────────
    // fetchConfigurationsForControl
    // ──────────────────────────────────────────────────
    describe('fetchConfigurationsForControl', () => {
        it('should call the correct endpoint and return config IDs', async () => {
            const expected = [10, 20, 30];
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/configurations`).reply(200, { values: expected });

            const result = await controlService.fetchConfigurationsForControl(domain, controlId);
            expect(result).toEqual(expected);
        });

        it('should handle an empty configurations array', async () => {
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/configurations`).reply(200, { values: [] });

            const result = await controlService.fetchConfigurationsForControl(domain, controlId);
            expect(result).toEqual([]);
        });

        it('should default to empty array when values is missing', async () => {
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/configurations`).reply(200, {});

            const result = await controlService.fetchConfigurationsForControl(domain, controlId);
            expect(result).toEqual([]);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/configurations`).reply(500, { message: 'Error' });

            await expect(controlService.fetchConfigurationsForControl(domain, controlId)).rejects.toThrowError();
        });
    });

    // ──────────────────────────────────────────────────
    // fetchConfigurationVersions
    // ──────────────────────────────────────────────────
    describe('fetchConfigurationVersions', () => {
        it('should call the correct endpoint and return versions', async () => {
            const expected = ['1.0.0', '1.1.0'];
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions`).reply(200, { values: expected });

            const result = await controlService.fetchConfigurationVersions(domain, controlId, configId);
            expect(result).toEqual(expected);
        });

        it('should handle an empty versions array', async () => {
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions`).reply(200, { values: [] });

            const result = await controlService.fetchConfigurationVersions(domain, controlId, configId);
            expect(result).toEqual([]);
        });

        it('should default to empty array when values is missing', async () => {
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions`).reply(200, {});

            const result = await controlService.fetchConfigurationVersions(domain, controlId, configId);
            expect(result).toEqual([]);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions`).reply(500, { message: 'Error' });

            await expect(controlService.fetchConfigurationVersions(domain, controlId, configId)).rejects.toThrowError();
        });
    });

    // ──────────────────────────────────────────────────
    // fetchConfigurationForVersion
    // ──────────────────────────────────────────────────
    describe('fetchConfigurationForVersion', () => {
        const configJson = { minKeyLength: 256, algorithm: 'AES' };

        it('should call the correct endpoint and return the configuration JSON', async () => {
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions/${version}`).reply(200, configJson);

            const result = await controlService.fetchConfigurationForVersion(domain, controlId, configId, version);
            expect(result).toEqual(configJson);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions/${version}`).reply(500, { message: 'Error' });

            await expect(controlService.fetchConfigurationForVersion(domain, controlId, configId, version)).rejects.toThrowError();
        });
    });
});
