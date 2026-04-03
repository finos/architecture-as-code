import { describe, it, expect, afterEach } from 'vitest';
import AxiosMockAdapter from 'axios-mock-adapter';
import { InterfaceService } from './interface-service.js';
import axios from 'axios';

const ax = axios.create();
const mock = new AxiosMockAdapter(ax as never);

const namespace = 'org.finos';
const interfaceId = 1;
const version = '1.0.0';

describe('InterfaceService', () => {
    const interfaceService = new InterfaceService(ax);

    afterEach(() => {
        mock.reset();
    });

    // ──────────────────────────────────────────────────
    // fetchInterfacesForNamespace
    // ──────────────────────────────────────────────────
    describe('fetchInterfacesForNamespace', () => {
        const expectedInterfaces = [
            { id: 1, name: 'Payment API', description: 'Payment gateway interface' },
            { id: 2, name: 'Auth API', description: 'Authentication interface' },
        ];

        it('should call the correct endpoint and return interfaces', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/interfaces`).reply(200, { values: expectedInterfaces });

            const result = await interfaceService.fetchInterfacesForNamespace(namespace);
            expect(result).toEqual(expectedInterfaces);
        });

        it('should handle an empty interfaces array', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/interfaces`).reply(200, { values: [] });

            const result = await interfaceService.fetchInterfacesForNamespace(namespace);
            expect(result).toEqual([]);
        });

        it('should default to empty array when values is missing', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/interfaces`).reply(200, {});

            const result = await interfaceService.fetchInterfacesForNamespace(namespace);
            expect(result).toEqual([]);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/interfaces`).reply(500, { message: 'Error' });

            await expect(interfaceService.fetchInterfacesForNamespace(namespace)).rejects.toThrowError();
        });
    });

    // ──────────────────────────────────────────────────
    // fetchInterfaceVersions
    // ──────────────────────────────────────────────────
    describe('fetchInterfaceVersions', () => {
        it('should call the correct endpoint and return versions', async () => {
            const expected = ['1.0.0', '2.0.0'];
            mock.onGet(`/calm/namespaces/${namespace}/interfaces/${interfaceId}/versions`).reply(200, { values: expected });

            const result = await interfaceService.fetchInterfaceVersions(namespace, interfaceId);
            expect(result).toEqual(expected);
        });

        it('should handle an empty versions array', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/interfaces/${interfaceId}/versions`).reply(200, { values: [] });

            const result = await interfaceService.fetchInterfaceVersions(namespace, interfaceId);
            expect(result).toEqual([]);
        });

        it('should default to empty array when values is missing', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/interfaces/${interfaceId}/versions`).reply(200, {});

            const result = await interfaceService.fetchInterfaceVersions(namespace, interfaceId);
            expect(result).toEqual([]);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/interfaces/${interfaceId}/versions`).reply(500, { message: 'Error' });

            await expect(interfaceService.fetchInterfaceVersions(namespace, interfaceId)).rejects.toThrowError();
        });
    });

    // ──────────────────────────────────────────────────
    // fetchInterfaceForVersion
    // ──────────────────────────────────────────────────
    describe('fetchInterfaceForVersion', () => {
        const interfaceJson = { openapi: '3.0.0', info: { title: 'Payment API', version: '1.0.0' } };

        it('should call the correct endpoint and return the interface JSON', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/interfaces/${interfaceId}/versions/${version}`).reply(200, interfaceJson);

            const result = await interfaceService.fetchInterfaceForVersion(namespace, interfaceId, version);
            expect(result).toEqual(interfaceJson);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/interfaces/${interfaceId}/versions/${version}`).reply(500, { message: 'Error' });

            await expect(interfaceService.fetchInterfaceForVersion(namespace, interfaceId, version)).rejects.toThrowError();
        });
    });
});
