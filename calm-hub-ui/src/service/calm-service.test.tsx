import { afterEach, describe, expect, it } from 'vitest';
import AxiosMockAdapter from 'axios-mock-adapter';
import { CalmService } from './calm-service.js';
import axios from 'axios';

const ax = axios.create();
const mock = new AxiosMockAdapter(ax as never);

const namespace = 'test-namespace';
const resourceId = '1';
const version = '1.0.0';

describe('CalmService', () => {
    const calmService = new CalmService(ax);

    afterEach(() => {
        mock.reset();
    });

    describe('fetchNamespaces', () => {
        it('should retrieve all namespaces', async () => {
            const expectedNamespaces = [
                {
                    "name": "ns1",
                    "description": "namespace 1"
                },
                {
                    "name": "ns2",
                    "description": "namespace 2"
                },
                {
                    "name": "ns3",
                    "description": "namespace 3"
                }
            ];
            mock.onGet('/calm/namespaces').reply(200, { values: expectedNamespaces });
            const actual = await calmService.fetchNamespaces();
            expect(actual).toEqual(expectedNamespaces.map(ns => ns.name));
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet('/calm/namespaces').reply(500, { message: 'Error' });
            await expect(calmService.fetchNamespaces()).rejects.toThrowError();
        });
    });

    describe('fetchPatternIDs', () => {
        it('should retrieve pattern IDs for a namespace', async () => {
            const expectedIds = [1, 2, 3];
            mock.onGet(`/calm/namespaces/${namespace}/patterns`).reply(200, {
                values: expectedIds,
            });
            const actual = await calmService.fetchPatternIDs(namespace);
            expect(actual).toEqual(['1', '2', '3']);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/patterns`).reply(500, {
                message: 'Error',
            });
            await expect(calmService.fetchPatternIDs(namespace)).rejects.toThrowError();
        });
    });

    describe('fetchFlowIDs', () => {
        it('should retrieve flow IDs for a namespace', async () => {
            const expectedIds = [10, 20];
            mock.onGet(`/calm/namespaces/${namespace}/flows`).reply(200, {
                values: expectedIds,
            });
            const actual = await calmService.fetchFlowIDs(namespace);
            expect(actual).toEqual(['10', '20']);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/flows`).reply(500, {
                message: 'Error',
            });
            await expect(calmService.fetchFlowIDs(namespace)).rejects.toThrowError();
        });
    });

    describe('fetchArchitectureIDs', () => {
        it('should retrieve architecture IDs for a namespace', async () => {
            const expectedIds = [5, 6];
            mock.onGet(`/calm/namespaces/${namespace}/architectures`).reply(200, {
                values: expectedIds,
            });
            const actual = await calmService.fetchArchitectureIDs(namespace);
            expect(actual).toEqual(['5', '6']);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/architectures`).reply(500, {
                message: 'Error',
            });
            await expect(
                calmService.fetchArchitectureIDs(namespace)
            ).rejects.toThrowError();
        });
    });

    describe('fetchPatternVersions', () => {
        it('should retrieve versions for a pattern', async () => {
            const expectedVersions = ['1.0.0', '2.0.0'];
            mock.onGet(`/calm/namespaces/${namespace}/patterns/${resourceId}/versions`).reply(200, {
                values: expectedVersions,
            });
            const actual = await calmService.fetchPatternVersions(namespace, resourceId);
            expect(actual).toEqual(expectedVersions);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(
                `/calm/namespaces/${namespace}/patterns/${resourceId}/versions`
            ).reply(500, { message: 'Error' });
            await expect(
                calmService.fetchPatternVersions(namespace, resourceId)
            ).rejects.toThrowError();
        });
    });

    describe('fetchFlowVersions', () => {
        it('should retrieve versions for a flow', async () => {
            const expectedVersions = ['1.0.0', '2.0.0'];
            mock.onGet(`/calm/namespaces/${namespace}/flows/${resourceId}/versions`).reply(200, {
                values: expectedVersions,
            });
            const actual = await calmService.fetchFlowVersions(namespace, resourceId);
            expect(actual).toEqual(expectedVersions);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/flows/${resourceId}/versions`).reply(
                500,
                { message: 'Error' }
            );
            await expect(
                calmService.fetchFlowVersions(namespace, resourceId)
            ).rejects.toThrowError();
        });
    });

    describe('fetchArchitectureVersions', () => {
        it('should retrieve versions for an architecture', async () => {
            const expectedVersions = ['1.0.0', '2.0.0'];
            mock.onGet(
                `/calm/namespaces/${namespace}/architectures/${resourceId}/versions`
            ).reply(200, { values: expectedVersions });
            const actual = await calmService.fetchArchitectureVersions(namespace, resourceId);
            expect(actual).toEqual(expectedVersions);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(
                `/calm/namespaces/${namespace}/architectures/${resourceId}/versions`
            ).reply(500, { message: 'Error' });
            await expect(
                calmService.fetchArchitectureVersions(namespace, resourceId)
            ).rejects.toThrowError();
        });
    });

    describe('fetchPattern', () => {
        it('should retrieve a specific pattern', async () => {
            const responseData = { nodes: [], relationships: [] };
            mock.onGet(
                `/calm/namespaces/${namespace}/patterns/${resourceId}/versions/${version}`
            ).reply(200, responseData);
            const actual = await calmService.fetchPattern(namespace, resourceId, version);
            expect(actual).toEqual({
                id: resourceId,
                version: version,
                calmType: 'Patterns',
                name: namespace,
                data: responseData,
            });
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(
                `/calm/namespaces/${namespace}/patterns/${resourceId}/versions/${version}`
            ).reply(500, { message: 'Error' });
            await expect(
                calmService.fetchPattern(namespace, resourceId, version)
            ).rejects.toThrowError();
        });
    });

    describe('fetchFlow', () => {
        it('should retrieve a specific flow', async () => {
            const responseData = { nodes: [], relationships: [] };
            mock.onGet(
                `/calm/namespaces/${namespace}/flows/${resourceId}/versions/${version}`
            ).reply(200, responseData);
            const actual = await calmService.fetchFlow(namespace, resourceId, version);
            expect(actual).toEqual({
                id: resourceId,
                version: version,
                calmType: 'Flows',
                name: namespace,
                data: responseData,
            });
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(
                `/calm/namespaces/${namespace}/flows/${resourceId}/versions/${version}`
            ).reply(500, { message: 'Error' });
            await expect(
                calmService.fetchFlow(namespace, resourceId, version)
            ).rejects.toThrowError();
        });
    });

    describe('fetchArchitecture', () => {
        it('should retrieve a specific architecture', async () => {
            const responseData = { nodes: [], relationships: [] };
            mock.onGet(
                `/calm/namespaces/${namespace}/architectures/${resourceId}/versions/${version}`
            ).reply(200, responseData);
            const actual = await calmService.fetchArchitecture(namespace, resourceId, version);
            expect(actual).toEqual({
                id: resourceId,
                version: version,
                calmType: 'Architectures',
                name: namespace,
                data: responseData,
            });
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(
                `/calm/namespaces/${namespace}/architectures/${resourceId}/versions/${version}`
            ).reply(500, { message: 'Error' });
            await expect(
                calmService.fetchArchitecture(namespace, resourceId, version)
            ).rejects.toThrowError();
        });
    });

    describe('fetchDecoratorValues', () => {
        it('should retrieve decorator values for a namespace', async () => {
            const decorators = [
                { uniqueId: 'dec-1', type: 'deployment', target: ['node-a'] },
                { uniqueId: 'dec-2', type: 'deployment', target: ['node-b'] },
            ];
            mock.onGet(`/calm/namespaces/${namespace}/decorators/values`).reply(200, {
                values: decorators,
            });
            const actual = await calmService.fetchDecoratorValues(namespace);
            expect(actual).toEqual(decorators);
        });

        it('should pass target and type query params when provided', async () => {
            const decorators = [{ uniqueId: 'dec-1', type: 'deployment', target: ['node-a'] }];
            mock.onGet(`/calm/namespaces/${namespace}/decorators/values?target=node-a&type=deployment`).reply(200, {
                values: decorators,
            });
            const actual = await calmService.fetchDecoratorValues(namespace, 'node-a', 'deployment');
            expect(actual).toEqual(decorators);
        });

        it('should return an empty array when backend returns error status', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/decorators/values`).reply(500, {
                message: 'Error',
            });
            const actual = await calmService.fetchDecoratorValues(namespace);
            expect(actual).toEqual([]);
        });
    });
});
