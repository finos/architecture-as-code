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

    describe('fetchPatternSummaries', () => {
        it('should retrieve pattern summaries for a namespace', async () => {
            const expectedSummaries = [
                { id: 1, name: 'Pattern One', description: 'First' },
                { id: 2, name: 'Pattern Two', description: 'Second' },
            ];
            mock.onGet(`/calm/namespaces/${encodeURIComponent(namespace)}/patterns`).reply(200, {
                values: expectedSummaries,
            });
            const actual = await calmService.fetchPatternSummaries(namespace);
            expect(actual).toEqual(expectedSummaries);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/namespaces/${encodeURIComponent(namespace)}/patterns`).reply(500, {
                message: 'Error',
            });
            await expect(calmService.fetchPatternSummaries(namespace)).rejects.toThrowError();
        });
    });

    describe('fetchFlowSummaries', () => {
        it('should retrieve flow summaries for a namespace', async () => {
            const expectedSummaries = [
                { id: 10, name: 'Flow One', description: 'First' },
                { id: 20, name: 'Flow Two', description: 'Second' },
            ];
            mock.onGet(`/calm/namespaces/${encodeURIComponent(namespace)}/flows`).reply(200, {
                values: expectedSummaries,
            });
            const actual = await calmService.fetchFlowSummaries(namespace);
            expect(actual).toEqual(expectedSummaries);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/namespaces/${encodeURIComponent(namespace)}/flows`).reply(500, {
                message: 'Error',
            });
            await expect(calmService.fetchFlowSummaries(namespace)).rejects.toThrowError();
        });
    });

    describe('fetchArchitectureSummaries', () => {
        it('should retrieve architecture summaries for a namespace', async () => {
            const expectedSummaries = [
                { id: 5, name: 'Arch One', description: 'First' },
                { id: 6, name: 'Arch Two', description: 'Second' },
            ];
            mock.onGet(`/calm/namespaces/${namespace}/architectures`).reply(200, {
                values: expectedSummaries,
            });
            const actual = await calmService.fetchArchitectureSummaries(namespace);
            expect(actual).toEqual(expectedSummaries);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/architectures`).reply(500, {
                message: 'Error',
            });
            await expect(
                calmService.fetchArchitectureSummaries(namespace)
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

    describe('fetchStandardSummaries', () => {
        it('should retrieve standard summaries for a namespace', async () => {
            const expectedSummaries = [
                { id: 10, name: 'Standard One', description: 'First' },
                { id: 20, name: 'Standard Two', description: 'Second' },
            ];
            mock.onGet(`/calm/namespaces/${encodeURIComponent(namespace)}/standards`).reply(200, {
                values: expectedSummaries,
            });
            const actual = await calmService.fetchStandardSummaries(namespace);
            expect(actual).toEqual(expectedSummaries);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/calm/namespaces/${encodeURIComponent(namespace)}/standards`).reply(500, {
                message: 'Error',
            });
            await expect(calmService.fetchStandardSummaries(namespace)).rejects.toThrowError();
        });
    });

    describe('fetchStandardVersions', () => {
        it('should retrieve versions for a standard', async () => {
            const expectedVersions = ['1.0.0', '2.0.0'];
            mock.onGet(`/calm/namespaces/${encodeURIComponent(namespace)}/standards/${resourceId}/versions`).reply(200, {
                values: expectedVersions,
            });
            const actual = await calmService.fetchStandardVersions(namespace, resourceId);
            expect(actual).toEqual(expectedVersions);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(
                `/calm/namespaces/${encodeURIComponent(namespace)}/standards/${resourceId}/versions`
            ).reply(500, { message: 'Error' });
            await expect(
                calmService.fetchStandardVersions(namespace, resourceId)
            ).rejects.toThrowError();
        });
    });

    describe('fetchStandard', () => {
        it('should retrieve a specific standard', async () => {
            const responseData = { nodes: [], relationships: [] };
            mock.onGet(
                `/calm/namespaces/${encodeURIComponent(namespace)}/standards/${resourceId}/versions/${version}`
            ).reply(200, responseData);
            const actual = await calmService.fetchStandard(namespace, resourceId, version);
            expect(actual).toEqual({
                id: resourceId,
                version: version,
                calmType: 'Standards',
                name: namespace,
                data: responseData,
            });
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(
                `/calm/namespaces/${encodeURIComponent(namespace)}/standards/${resourceId}/versions/${version}`
            ).reply(500, { message: 'Error' });
            await expect(
                calmService.fetchStandard(namespace, resourceId, version)
            ).rejects.toThrowError();
        });
    });

    describe('fetchDecoratorValues', () => {
        it('should retrieve decorator values for a namespace', async () => {
            const decorators = [
                {
                    schema: 'https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.standard.json',
                    uniqueId: 'dec-1',
                    type: 'deployment',
                    target: ['/calm/namespaces/my-namespace/architectures/my-arch/versions/1-0-0'],
                    appliesTo: ['node-a'],
                    data: {
                        status: 'completed',
                        'start-time': '2024-01-01T10:00:00Z',
                        'end-time': '2024-01-01T10:05:00Z',
                    },
                },
                {
                    schema: 'https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.standard.json',
                    uniqueId: 'dec-2',
                    type: 'deployment',
                    target: ['/calm/namespaces/my-namespace/architectures/my-arch/versions/1-0-0'],
                    appliesTo: ['node-b'],
                    data: {
                        status: 'failed',
                        'start-time': '2024-01-01T11:00:00Z',
                        'end-time': '2024-01-01T11:02:00Z',
                    },
                },
            ];
            mock.onGet(`/calm/namespaces/${namespace}/decorators/values`).reply(200, {
                values: decorators,
            });
            const actual = await calmService.fetchDecoratorValues(namespace);
            expect(actual).toEqual(decorators);
        });

        it('should pass target and type query params when provided', async () => {
            const decorators = [{
                schema: 'https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.standard.json',
                uniqueId: 'dec-1',
                type: 'deployment',
                target: ['/calm/namespaces/my-namespace/architectures/my-arch/versions/1-0-0'],
                appliesTo: ['node-a'],
                data: {
                    status: 'completed',
                    'start-time': '2024-01-01T10:00:00Z',
                    'end-time': '2024-01-01T10:05:00Z',
                },
            }];
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
