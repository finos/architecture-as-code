import { describe, it, expect, afterEach } from 'vitest';
import AxiosMockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { UiConfigService } from './ui-config-service.js';
import { UiConfig } from '../model/ui-config.js';

const ax = axios.create();
const mock = new AxiosMockAdapter(ax as never);
const service = new UiConfigService(ax);

afterEach(() => mock.reset());

describe('UiConfigService', () => {
    it('returns the config from the endpoint', async () => {
        const config: UiConfig = {
            environment: { name: 'UAT', colour: 'warning' },
            identity: { name: 'alice' },
            items: [{ label: 'Support', url: 'https://support.example.com' }],
        };
        mock.onGet('/api/calm/ui/config').reply(200, config);

        await expect(service.getUiConfig()).resolves.toEqual(config);
    });

    it('returns an empty config when the body is not an object', async () => {
        mock.onGet('/api/calm/ui/config').reply(200, '');

        await expect(service.getUiConfig()).resolves.toEqual({});
    });

    it('rejects when the request fails', async () => {
        mock.onGet('/api/calm/ui/config').reply(500);

        await expect(service.getUiConfig()).rejects.toThrow('Error fetching UI config:');
    });
});
