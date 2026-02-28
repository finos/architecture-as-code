import { afterEach, describe, expect, it } from 'vitest';
import AxiosMockAdapter from 'axios-mock-adapter';
import { CalmService } from './calm-service.js';
import axios from 'axios';

const ax = axios.create();
const mock = new AxiosMockAdapter(ax as never);

const namespace = 'test-namespace';
const resourceId = '1';
const version = '1.0.0';

const errorStatusCodes = [400, 401, 403, 404, 500];

describe('CalmService', () => {
    const calmService = new CalmService(ax);

    afterEach(() => {
        mock.reset();
    });

    describe('fetchNamespaces', () => {
        it('should retrieve all namespaces', async () => {
            const expectedNamespaces = ['ns1', 'ns2'];
            mock.onGet('/calm/namespaces').reply(200, { values: expectedNamespaces });
            const actual = await calmService.fetchNamespaces();
            expect(actual).toEqual(expectedNamespaces);
        });

        it.each(errorStatusCodes)(
            'should throw an error when backend returns status %i',
            async (statusCode) => {
                mock.onGet('/calm/namespaces').reply(statusCode, { message: 'Error' });
                await expect(calmService.fetchNamespaces()).rejects.toThrowError();
            }
        );
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

        it.each(errorStatusCodes)(
            'should throw an error when backend returns status %i',
            async (statusCode) => {
                mock.onGet(`/calm/namespaces/${namespace}/patterns`).reply(statusCode, {
                    message: 'Error',
                });
                await expect(calmService.fetchPatternIDs(namespace)).rejects.toThrowError();
            }
        );
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

        it.each(errorStatusCodes)(
            'should throw an error when backend returns status %i',
            async (statusCode) => {
                mock.onGet(`/calm/namespaces/${namespace}/flows`).reply(statusCode, {
                    message: 'Error',
                });
                await expect(calmService.fetchFlowIDs(namespace)).rejects.toThrowError();
            }
        );
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

        it.each(errorStatusCodes)(
            'should throw an error when backend returns status %i',
            async (statusCode) => {
                mock.onGet(`/calm/namespaces/${namespace}/architectures`).reply(statusCode, {
                    message: 'Error',
                });
                await expect(
                    calmService.fetchArchitectureIDs(namespace)
                ).rejects.toThrowError();
            }
        );
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

        it.each(errorStatusCodes)(
            'should throw an error when backend returns status %i',
            async (statusCode) => {
                mock.onGet(
                    `/calm/namespaces/${namespace}/patterns/${resourceId}/versions`
                ).reply(statusCode, { message: 'Error' });
                await expect(
                    calmService.fetchPatternVersions(namespace, resourceId)
                ).rejects.toThrowError();
            }
        );
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

        it.each(errorStatusCodes)(
            'should throw an error when backend returns status %i',
            async (statusCode) => {
                mock.onGet(`/calm/namespaces/${namespace}/flows/${resourceId}/versions`).reply(
                    statusCode,
                    { message: 'Error' }
                );
                await expect(
                    calmService.fetchFlowVersions(namespace, resourceId)
                ).rejects.toThrowError();
            }
        );
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

        it.each(errorStatusCodes)(
            'should throw an error when backend returns status %i',
            async (statusCode) => {
                mock.onGet(
                    `/calm/namespaces/${namespace}/architectures/${resourceId}/versions`
                ).reply(statusCode, { message: 'Error' });
                await expect(
                    calmService.fetchArchitectureVersions(namespace, resourceId)
                ).rejects.toThrowError();
            }
        );
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

        it.each(errorStatusCodes)(
            'should throw an error when backend returns status %i',
            async (statusCode) => {
                mock.onGet(
                    `/calm/namespaces/${namespace}/patterns/${resourceId}/versions/${version}`
                ).reply(statusCode, { message: 'Error' });
                await expect(
                    calmService.fetchPattern(namespace, resourceId, version)
                ).rejects.toThrowError();
            }
        );
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

        it.each(errorStatusCodes)(
            'should throw an error when backend returns status %i',
            async (statusCode) => {
                mock.onGet(
                    `/calm/namespaces/${namespace}/flows/${resourceId}/versions/${version}`
                ).reply(statusCode, { message: 'Error' });
                await expect(
                    calmService.fetchFlow(namespace, resourceId, version)
                ).rejects.toThrowError();
            }
        );
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

        it.each(errorStatusCodes)(
            'should throw an error when backend returns status %i',
            async (statusCode) => {
                mock.onGet(
                    `/calm/namespaces/${namespace}/architectures/${resourceId}/versions/${version}`
                ).reply(statusCode, { message: 'Error' });
                await expect(
                    calmService.fetchArchitecture(namespace, resourceId, version)
                ).rejects.toThrowError();
            }
        );
    });
});
