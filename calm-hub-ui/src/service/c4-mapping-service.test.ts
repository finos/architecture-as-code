import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { C4MappingService } from './c4-mapping-service.js';

vi.mock('../authService.js', () => ({ getAuthHeaders: vi.fn(async () => ({ Authorization: 'Bearer token' })) }));

const ax = axios.create();
const mock = new AxiosMockAdapter(ax);
const service = new C4MappingService(ax);

afterEach(() => mock.reset());

describe('C4MappingService', () => {
    describe('fetchDefaultMapping', () => {
        it('returns the default that applies to the namespace', async () => {
            const body = { configType: 'c4-mapping', namespace: 'org', configId: 3, version: '1.1.0', inherited: true, config: { 'unique-id': 'acme' } };
            mock.onGet('/api/calm/namespaces/org.team/configs/c4-mapping/default').reply(200, body);

            await expect(service.fetchDefaultMapping('org.team')).resolves.toEqual(body);
        });

        it('returns undefined when no namespace in the chain sets a default', async () => {
            mock.onGet('/api/calm/namespaces/org/configs/c4-mapping/default').reply(404, 'Not found');

            await expect(service.fetchDefaultMapping('org')).resolves.toBeUndefined();
        });

        it('rejects on any other error', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            mock.onGet('/api/calm/namespaces/org/configs/c4-mapping/default').reply(500);

            await expect(service.fetchDefaultMapping('org')).rejects.toThrow('Error fetching the C4 mapping of namespace org:');
        });
    });

    describe('fetchMappingAt', () => {
        it('reads a config on this Hub through the API, with credentials', async () => {
            mock.onGet('/api/calm/namespaces/org/configs/c4-mapping/3/versions/1.0.0').reply((config) => [200, { auth: config.headers?.Authorization }]);

            await expect(service.fetchMappingAt('https://hub.example.com/calm/namespaces/org/configs/c4-mapping/3/versions/1.0.0', 'hub.example.com')).resolves.toEqual({
                auth: 'Bearer token',
            });
        });

        it('fetches any other URL without credentials', async () => {
            mock.onGet('https://example.com/acme.json').reply((config) => [200, { auth: config.headers?.Authorization ?? null }]);

            await expect(service.fetchMappingAt('https://example.com/acme.json', 'hub.example.com')).resolves.toEqual({ auth: null });
        });

        it('rejects when the mapping does not load', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            mock.onGet('https://example.com/acme.json').reply(404);

            await expect(service.fetchMappingAt('https://example.com/acme.json', 'hub.example.com')).rejects.toThrow(
                'Error fetching the C4 mapping at https://example.com/acme.json:',
            );
        });
    });
});
