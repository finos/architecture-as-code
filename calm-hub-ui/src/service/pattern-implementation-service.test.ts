import { describe, it, expect, afterEach, vi } from 'vitest';
import AxiosMockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { PatternImplementationService } from './pattern-implementation-service.js';

const ax = axios.create();
const mock = new AxiosMockAdapter(ax as never);
const PATH = '/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0/implementations';

describe('PatternImplementationService', () => {
    const service = new PatternImplementationService(ax);

    afterEach(() => {
        mock.reset();
        vi.restoreAllMocks();
    });

    it('returns the implementations of the pattern version', async () => {
        const implementations = [{ namespace: 'finos', architectureId: 7, version: '1.2.0', customId: 'trade-capture' }];
        mock.onGet(PATH).reply(200, { pattern: { namespace: 'finos', name: 'api-gateway', version: '1.0.0' }, implementations });

        expect(await service.fetchImplementations('finos', 'api-gateway', '1.0.0')).toEqual(implementations);
    });

    it('returns an empty list when the response has no implementations array', async () => {
        mock.onGet(PATH).reply(200, {});

        expect(await service.fetchImplementations('finos', 'api-gateway', '1.0.0')).toEqual([]);
    });

    it('encodes each path segment', async () => {
        mock.onGet('/calm/namespaces/a%2Fb/patterns/c%20d/versions/1.0.0-SNAPSHOT/implementations').reply(200, { implementations: [] });

        expect(await service.fetchImplementations('a/b', 'c d', '1.0.0-SNAPSHOT')).toEqual([]);
    });

    it('returns null when the hub does not support the lookup', async () => {
        mock.onGet(PATH).reply(501, { error: 'Pattern implementations are not available in GitHub storage mode.' });

        expect(await service.fetchImplementations('finos', 'api-gateway', '1.0.0')).toBeNull();
    });

    it('rejects on any other failure', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mock.onGet(PATH).reply(500);

        await expect(service.fetchImplementations('finos', 'api-gateway', '1.0.0')).rejects.toThrow(
            'Error fetching implementations of pattern api-gateway:'
        );
    });
});
