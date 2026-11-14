import { afterEach, describe, expect, it } from 'vitest';
import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { ConfigService } from './config-service.js';

const ax = axios.create();
const mock = new AxiosMockAdapter(ax as never);
const service = new ConfigService(ax);
const base = '/api/calm/namespaces/org.team/configs/c4-mapping';

describe('ConfigService', () => {
    afterEach(() => mock.reset());

    it('fetches the config types', async () => {
        const types = [{ type: 'c4-mapping', schema: 'https://calm.finos.org/standards/c4/1.0/c4-mapping.json' }];
        mock.onGet('/api/calm/config-types').reply(200, { values: types });
        await expect(service.fetchConfigTypes()).resolves.toEqual(types);
    });

    it('fetches the configs of a type in a namespace', async () => {
        const configs = [{ id: 3, name: 'acme', versionCount: 2 }];
        mock.onGet(base).reply(200, { values: configs });
        await expect(service.fetchConfigs('org.team', 'c4-mapping')).resolves.toEqual(configs);
    });

    it('rejects when the configs request fails', async () => {
        mock.onGet(base).reply(500);
        await expect(service.fetchConfigs('org.team', 'c4-mapping')).rejects.toThrow('Error fetching c4-mapping configs');
    });

    it('returns the namespace default, or undefined on 404, and rejects on other failures', async () => {
        const resolved = { configType: 'c4-mapping', namespace: 'org', configId: 1, version: '1.0.0', inherited: true, config: {} };
        mock.onGet(`${base}/default`).replyOnce(200, resolved);
        await expect(service.fetchNamespaceDefault('org.team', 'c4-mapping')).resolves.toEqual(resolved);

        mock.onGet(`${base}/default`).replyOnce(404);
        await expect(service.fetchNamespaceDefault('org.team', 'c4-mapping')).resolves.toBeUndefined();

        mock.onGet(`${base}/default`).replyOnce(500);
        await expect(service.fetchNamespaceDefault('org.team', 'c4-mapping')).rejects.toThrow('Error fetching the c4-mapping default');
    });
});
