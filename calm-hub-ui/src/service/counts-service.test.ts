import { describe, it, expect, afterEach } from 'vitest';
import AxiosMockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { CountsService } from './counts-service.js';

const ax = axios.create();
const mock = new AxiosMockAdapter(ax as never);

describe('CountsService', () => {
    const service = new CountsService(ax);

    afterEach(() => {
        mock.reset();
    });

    describe('fetchNamespaceCounts', () => {
        const expected = [
            {
                namespace: 'finos',
                architectures: 2,
                patterns: 1,
                flows: 3,
                standards: 1,
                adrs: 2,
                interfaces: 1,
                total: 10,
            },
        ];

        it('calls the correct endpoint and returns the counts values', async () => {
            mock.onGet('/api/calm/namespaces/counts').reply(200, { values: expected });

            const result = await service.fetchNamespaceCounts();
            expect(result).toEqual(expected);
        });

        it('returns an empty array when values is missing', async () => {
            mock.onGet('/api/calm/namespaces/counts').reply(200, {});

            const result = await service.fetchNamespaceCounts();
            expect(result).toEqual([]);
        });

        it('returns an empty array when values is empty', async () => {
            mock.onGet('/api/calm/namespaces/counts').reply(200, { values: [] });

            const result = await service.fetchNamespaceCounts();
            expect(result).toEqual([]);
        });

        it('rejects when the backend returns an error status', async () => {
            mock.onGet('/api/calm/namespaces/counts').reply(500, { message: 'Error' });

            await expect(service.fetchNamespaceCounts()).rejects.toThrowError();
        });
    });

    describe('fetchDomainCounts', () => {
        const expected = [
            { domain: 'security', controlCount: 5 },
            { domain: 'compliance', controlCount: 0 },
        ];

        it('calls the correct endpoint and returns the counts values', async () => {
            mock.onGet('/api/calm/domains/counts').reply(200, { values: expected });

            const result = await service.fetchDomainCounts();
            expect(result).toEqual(expected);
        });

        it('returns an empty array when values is missing', async () => {
            mock.onGet('/api/calm/domains/counts').reply(200, {});

            const result = await service.fetchDomainCounts();
            expect(result).toEqual([]);
        });

        it('rejects when the backend returns an error status', async () => {
            mock.onGet('/api/calm/domains/counts').reply(500, { message: 'Error' });

            await expect(service.fetchDomainCounts()).rejects.toThrowError();
        });
    });
});
