import { afterEach, describe, expect, it } from 'vitest';
import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { ConventionService } from './convention-service.js';

const ax = axios.create();
const mock = new AxiosMockAdapter(ax as never);
const service = new ConventionService(ax);
const base = '/api/calm/namespaces/org.team/conventions/c4-mapping';

describe('ConventionService', () => {
    afterEach(() => mock.reset());

    it('fetches the convention types', async () => {
        const types = [{ type: 'c4-mapping', schema: 'https://calm.finos.org/standards/c4/1.0/c4-mapping.json' }];
        mock.onGet('/api/calm/convention-types').reply(200, { values: types });
        await expect(service.fetchConventionTypes()).resolves.toEqual(types);
    });

    it('fetches the conventions of a type in a namespace', async () => {
        const conventions = [{ id: 3, name: 'acme', versionCount: 2 }];
        mock.onGet(base).reply(200, { values: conventions });
        await expect(service.fetchConventions('org.team', 'c4-mapping')).resolves.toEqual(conventions);
    });

    it('rejects when the conventions request fails', async () => {
        mock.onGet(base).reply(500);
        await expect(service.fetchConventions('org.team', 'c4-mapping')).rejects.toThrow('Error fetching c4-mapping conventions');
    });

    it('returns the namespace default, or undefined on 404, and rejects on other failures', async () => {
        const resolved = { conventionType: 'c4-mapping', namespace: 'org', conventionId: 1, version: '1.0.0', inherited: true, convention: {} };
        mock.onGet(`${base}/default`).replyOnce(200, resolved);
        await expect(service.fetchNamespaceDefault('org.team', 'c4-mapping')).resolves.toEqual(resolved);

        mock.onGet(`${base}/default`).replyOnce(404);
        await expect(service.fetchNamespaceDefault('org.team', 'c4-mapping')).resolves.toBeUndefined();

        mock.onGet(`${base}/default`).replyOnce(500);
        await expect(service.fetchNamespaceDefault('org.team', 'c4-mapping')).rejects.toThrow('Error fetching the c4-mapping default');
    });
});
