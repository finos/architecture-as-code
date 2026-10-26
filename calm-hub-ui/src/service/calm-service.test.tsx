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
            mock.onGet('/api/calm/namespaces').reply(200, { values: expectedNamespaces });
            const actual = await calmService.fetchNamespaces();
            expect(actual).toEqual(expectedNamespaces.map(ns => ns.name));
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet('/api/calm/namespaces').reply(500, { message: 'Error' });
            await expect(calmService.fetchNamespaces()).rejects.toThrowError();
        });

        it('should return namespaces in alphabetical order regardless of API response order', async () => {
            mock.onGet('/api/calm/namespaces').reply(200, {
                values: [
                    { name: 'zebra', description: '' },
                    { name: 'apple', description: '' },
                    { name: 'mango', description: '' },
                ],
            });
            const actual = await calmService.fetchNamespaces();
            expect(actual).toEqual(['apple', 'mango', 'zebra']);
        });
    });

    describe('fetchNamespaceDetails', () => {
        it('should retrieve namespace name and description pairs', async () => {
            const expectedNamespaces = [
                { name: 'ns1', description: 'namespace 1' },
                { name: 'ns2', description: 'namespace 2' },
            ];
            mock.onGet('/api/calm/namespaces').reply(200, { values: expectedNamespaces });
            const actual = await calmService.fetchNamespaceDetails();
            expect(actual).toEqual(expectedNamespaces);
        });

        it('should return namespaces in alphabetical order regardless of API response order', async () => {
            mock.onGet('/api/calm/namespaces').reply(200, {
                values: [
                    { name: 'zebra', description: '' },
                    { name: 'apple', description: '' },
                    { name: 'mango', description: '' },
                ],
            });
            const actual = await calmService.fetchNamespaceDetails();
            expect(actual.map((ns) => ns.name)).toEqual(['apple', 'mango', 'zebra']);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet('/api/calm/namespaces').reply(500, { message: 'Error' });
            await expect(calmService.fetchNamespaceDetails()).rejects.toThrowError();
        });
    });

    describe('createNamespace', () => {
        it('should post the name and description', async () => {
            mock.onPost('/api/calm/namespaces', { name: 'ns1', description: 'desc' }).reply(201);
            await expect(calmService.createNamespace('ns1', 'desc')).resolves.toBeUndefined();
        });

        it('should surface the server-provided error message from a JSON error body', async () => {
            mock.onPost('/api/calm/namespaces').reply(409, { error: 'Namespace already exists' });
            await expect(calmService.createNamespace('ns1', 'desc')).rejects.toThrowError('Namespace already exists');
        });

        it('should surface the server-provided error message from a plain-text error body', async () => {
            mock.onPost('/api/calm/namespaces').reply(404, 'Invalid namespace provided: ns1');
            await expect(calmService.createNamespace('ns1', 'desc')).rejects.toThrowError('Invalid namespace provided: ns1');
        });

        it('should fall back to a generic error message when the body has no error text', async () => {
            mock.onPost('/api/calm/namespaces').reply(500, { message: 'unexpected' });
            await expect(calmService.createNamespace('ns1', 'desc')).rejects.toThrowError('Error creating namespace ns1:');
        });
    });

    describe('updateNamespace', () => {
        it('should put the new description', async () => {
            mock.onPut('/api/calm/namespaces/ns1', { description: 'new desc' }).reply(204);
            await expect(calmService.updateNamespace('ns1', 'new desc')).resolves.toBeUndefined();
        });

        it('should surface the server-provided error message when the namespace is missing', async () => {
            mock.onPut('/api/calm/namespaces/missing').reply(404, 'Invalid namespace provided: missing');
            await expect(calmService.updateNamespace('missing', 'desc'))
                .rejects.toThrowError('Invalid namespace provided: missing');
        });
    });

    describe('deleteNamespace', () => {
        it('should delete the namespace', async () => {
            mock.onDelete('/api/calm/namespaces/ns1').reply(204);
            await expect(calmService.deleteNamespace('ns1')).resolves.toBeUndefined();
        });

        it('should surface the server-provided error message when the namespace is not empty', async () => {
            mock.onDelete('/api/calm/namespaces/ns1')
                .reply(409, 'Namespace ns1 contains resources and cannot be deleted');
            await expect(calmService.deleteNamespace('ns1'))
                .rejects.toThrowError('Namespace ns1 contains resources and cannot be deleted');
        });
    });

    describe('fetchDomains', () => {
        it('should retrieve all domains', async () => {
            mock.onGet('/api/calm/domains').reply(200, { values: ['retail', 'wholesale'] });
            const actual = await calmService.fetchDomains();
            expect(actual).toEqual(['retail', 'wholesale']);
        });

        it('should return domains in alphabetical order regardless of API response order', async () => {
            mock.onGet('/api/calm/domains').reply(200, { values: ['wholesale', 'retail'] });
            const actual = await calmService.fetchDomains();
            expect(actual).toEqual(['retail', 'wholesale']);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet('/api/calm/domains').reply(500, { message: 'Error' });
            await expect(calmService.fetchDomains()).rejects.toThrowError();
        });
    });

    describe('createDomain', () => {
        it('should post the name', async () => {
            mock.onPost('/api/calm/domains', { name: 'retail' }).reply(201);
            await expect(calmService.createDomain('retail')).resolves.toBeUndefined();
        });

        it('should surface the server-provided error message on conflict', async () => {
            mock.onPost('/api/calm/domains').reply(409, { error: 'Domain already exists' });
            await expect(calmService.createDomain('retail')).rejects.toThrowError('Domain already exists');
        });
    });

    describe('deleteDomain', () => {
        it('should delete the domain', async () => {
            mock.onDelete('/api/calm/domains/retail').reply(204);
            await expect(calmService.deleteDomain('retail')).resolves.toBeUndefined();
        });

        it('should surface the server-provided error message when the domain is not empty', async () => {
            mock.onDelete('/api/calm/domains/retail')
                .reply(409, 'Domain retail contains controls and cannot be deleted');
            await expect(calmService.deleteDomain('retail'))
                .rejects.toThrowError('Domain retail contains controls and cannot be deleted');
        });
    });

    describe('fetchPatternSummaries', () => {
        it('should retrieve pattern summaries for a namespace', async () => {
            const expectedSummaries = [
                { id: 1, name: 'Pattern One', description: 'First' },
                { id: 2, name: 'Pattern Two', description: 'Second' },
            ];
            mock.onGet(`/api/calm/namespaces/${encodeURIComponent(namespace)}/patterns`).reply(200, {
                values: expectedSummaries,
            });
            const actual = await calmService.fetchPatternSummaries(namespace);
            expect(actual).toEqual(expectedSummaries);
        });

        it('should not send limit/offset params when none are supplied', async () => {
            mock.onGet(`/api/calm/namespaces/${encodeURIComponent(namespace)}/patterns`).reply(200, {
                values: [],
            });
            await calmService.fetchPatternSummaries(namespace);
            expect(mock.history.get[0].url).toBe(
                `/api/calm/namespaces/${encodeURIComponent(namespace)}/patterns`
            );
        });

        it('should send a limit param when a limit is supplied', async () => {
            mock.onGet(`/api/calm/namespaces/${encodeURIComponent(namespace)}/patterns?limit=3`).reply(200, {
                values: [],
            });
            await calmService.fetchPatternSummaries(namespace, 3);
            expect(mock.history.get[0].url).toBe(
                `/api/calm/namespaces/${encodeURIComponent(namespace)}/patterns?limit=3`
            );
        });

        it('should send both limit and offset params when supplied', async () => {
            mock.onGet(`/api/calm/namespaces/${encodeURIComponent(namespace)}/patterns?limit=3&offset=6`).reply(200, {
                values: [],
            });
            await calmService.fetchPatternSummaries(namespace, 3, 6);
            expect(mock.history.get[0].url).toBe(
                `/api/calm/namespaces/${encodeURIComponent(namespace)}/patterns?limit=3&offset=6`
            );
        });

        it('should not send params when only an offset is supplied (backend applies offset only with a limit)', async () => {
            mock.onGet(`/api/calm/namespaces/${encodeURIComponent(namespace)}/patterns`).reply(200, {
                values: [],
            });
            await calmService.fetchPatternSummaries(namespace, undefined, 6);
            expect(mock.history.get[0].url).toBe(
                `/api/calm/namespaces/${encodeURIComponent(namespace)}/patterns`
            );
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/api/calm/namespaces/${encodeURIComponent(namespace)}/patterns`).reply(500, {
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
            mock.onGet(`/api/calm/namespaces/${encodeURIComponent(namespace)}/flows`).reply(200, {
                values: expectedSummaries,
            });
            const actual = await calmService.fetchFlowSummaries(namespace);
            expect(actual).toEqual(expectedSummaries);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/api/calm/namespaces/${encodeURIComponent(namespace)}/flows`).reply(500, {
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
            mock.onGet(`/api/calm/namespaces/${namespace}/architectures`).reply(200, {
                values: expectedSummaries,
            });
            const actual = await calmService.fetchArchitectureSummaries(namespace);
            expect(actual).toEqual(expectedSummaries);
        });

        it('should not send limit/offset params when none are supplied', async () => {
            mock.onGet(`/api/calm/namespaces/${namespace}/architectures`).reply(200, {
                values: [],
            });
            await calmService.fetchArchitectureSummaries(namespace);
            expect(mock.history.get[0].url).toBe(
                `/api/calm/namespaces/${namespace}/architectures`
            );
        });

        it('should send a limit param when a limit is supplied', async () => {
            mock.onGet(`/api/calm/namespaces/${namespace}/architectures?limit=3`).reply(200, {
                values: [],
            });
            await calmService.fetchArchitectureSummaries(namespace, 3);
            expect(mock.history.get[0].url).toBe(
                `/api/calm/namespaces/${namespace}/architectures?limit=3`
            );
        });

        it('should send both limit and offset params when supplied', async () => {
            mock.onGet(`/api/calm/namespaces/${namespace}/architectures?limit=3&offset=6`).reply(200, {
                values: [],
            });
            await calmService.fetchArchitectureSummaries(namespace, 3, 6);
            expect(mock.history.get[0].url).toBe(
                `/api/calm/namespaces/${namespace}/architectures?limit=3&offset=6`
            );
        });

        it('should not send params when only an offset is supplied (backend applies offset only with a limit)', async () => {
            mock.onGet(`/api/calm/namespaces/${namespace}/architectures`).reply(200, {
                values: [],
            });
            await calmService.fetchArchitectureSummaries(namespace, undefined, 6);
            expect(mock.history.get[0].url).toBe(
                `/api/calm/namespaces/${namespace}/architectures`
            );
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/api/calm/namespaces/${namespace}/architectures`).reply(500, {
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
            mock.onGet(`/api/calm/namespaces/${namespace}/patterns/${resourceId}/versions`).reply(200, {
                values: expectedVersions,
            });
            const actual = await calmService.fetchPatternVersions(namespace, resourceId);
            expect(actual).toEqual(expectedVersions);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(
                `/api/calm/namespaces/${namespace}/patterns/${resourceId}/versions`
            ).reply(500, { message: 'Error' });
            await expect(
                calmService.fetchPatternVersions(namespace, resourceId)
            ).rejects.toThrowError();
        });
    });

    describe('fetchFlowVersions', () => {
        it('should retrieve versions for a flow', async () => {
            const expectedVersions = ['1.0.0', '2.0.0'];
            mock.onGet(`/api/calm/namespaces/${namespace}/flows/${resourceId}/versions`).reply(200, {
                values: expectedVersions,
            });
            const actual = await calmService.fetchFlowVersions(namespace, resourceId);
            expect(actual).toEqual(expectedVersions);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/api/calm/namespaces/${namespace}/flows/${resourceId}/versions`).reply(
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
                `/api/calm/namespaces/${namespace}/architectures/${resourceId}/versions`
            ).reply(200, { values: expectedVersions });
            const actual = await calmService.fetchArchitectureVersions(namespace, resourceId);
            expect(actual).toEqual(expectedVersions);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(
                `/api/calm/namespaces/${namespace}/architectures/${resourceId}/versions`
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
                `/api/calm/namespaces/${namespace}/patterns/${resourceId}/versions/${version}`
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
                `/api/calm/namespaces/${namespace}/patterns/${resourceId}/versions/${version}`
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
                `/api/calm/namespaces/${namespace}/flows/${resourceId}/versions/${version}`
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
                `/api/calm/namespaces/${namespace}/flows/${resourceId}/versions/${version}`
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
                `/api/calm/namespaces/${namespace}/architectures/${resourceId}/versions/${version}`
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
                `/api/calm/namespaces/${namespace}/architectures/${resourceId}/versions/${version}`
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
            mock.onGet(`/api/calm/namespaces/${encodeURIComponent(namespace)}/standards`).reply(200, {
                values: expectedSummaries,
            });
            const actual = await calmService.fetchStandardSummaries(namespace);
            expect(actual).toEqual(expectedSummaries);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(`/api/calm/namespaces/${encodeURIComponent(namespace)}/standards`).reply(500, {
                message: 'Error',
            });
            await expect(calmService.fetchStandardSummaries(namespace)).rejects.toThrowError();
        });
    });

    describe('fetchStandardVersions', () => {
        it('should retrieve versions for a standard', async () => {
            const expectedVersions = ['1.0.0', '2.0.0'];
            mock.onGet(`/api/calm/namespaces/${encodeURIComponent(namespace)}/standards/${resourceId}/versions`).reply(200, {
                values: expectedVersions,
            });
            const actual = await calmService.fetchStandardVersions(namespace, resourceId);
            expect(actual).toEqual(expectedVersions);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(
                `/api/calm/namespaces/${encodeURIComponent(namespace)}/standards/${resourceId}/versions`
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
                `/api/calm/namespaces/${encodeURIComponent(namespace)}/standards/${resourceId}/versions/${version}`
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
                `/api/calm/namespaces/${encodeURIComponent(namespace)}/standards/${resourceId}/versions/${version}`
            ).reply(500, { message: 'Error' });
            await expect(
                calmService.fetchStandard(namespace, resourceId, version)
            ).rejects.toThrowError();
        });
    });

    describe('fetchArchitectureTimeline', () => {
        const timelineDoc = {
            'current-moment': '1.1.0',
            moments: [
                { 'unique-id': '1.0.0', 'node-type': 'moment', name: '1.0.0', description: 'first' },
            ],
        };

        it('should retrieve the implied timeline for an architecture', async () => {
            mock.onGet(
                `/api/calm/namespaces/${encodeURIComponent(namespace)}/architectures/${encodeURIComponent(resourceId)}/timeline`
            ).reply(200, timelineDoc);
            const actual = await calmService.fetchArchitectureTimeline(namespace, resourceId);
            expect(actual).toEqual(timelineDoc);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet(
                `/api/calm/namespaces/${encodeURIComponent(namespace)}/architectures/${encodeURIComponent(resourceId)}/timeline`
            ).reply(500, { message: 'Error' });
            await expect(
                calmService.fetchArchitectureTimeline(namespace, resourceId)
            ).rejects.toThrowError();
        });
    });

    describe('fetchDecoratorValues', () => {
        it('should retrieve decorator values for a namespace', async () => {
            const decorators = [
                {
                    schema: 'https://calm.finos.org/standards/deployment/1.0/deployment.decorator.standard.json',
                    uniqueId: 'dec-1',
                    type: 'deployment',
                    target: ['/api/calm/namespaces/my-namespace/architectures/my-arch/versions/1-0-0'],
                    appliesTo: ['node-a'],
                    data: {
                        status: 'completed',
                        'start-time': '2024-01-01T10:00:00Z',
                        'end-time': '2024-01-01T10:05:00Z',
                    },
                },
                {
                    schema: 'https://calm.finos.org/standards/deployment/1.0/deployment.decorator.standard.json',
                    uniqueId: 'dec-2',
                    type: 'deployment',
                    target: ['/api/calm/namespaces/my-namespace/architectures/my-arch/versions/1-0-0'],
                    appliesTo: ['node-b'],
                    data: {
                        status: 'failed',
                        'start-time': '2024-01-01T11:00:00Z',
                        'end-time': '2024-01-01T11:02:00Z',
                    },
                },
            ];
            mock.onGet(`/api/calm/namespaces/${namespace}/decorators/values`).reply(200, {
                values: decorators,
            });
            const actual = await calmService.fetchDecoratorValues(namespace);
            expect(actual).toEqual(decorators);
        });

        it('should pass target and type query params when provided', async () => {
            const decorators = [{
                schema: 'https://calm.finos.org/standards/deployment/1.0/deployment.decorator.standard.json',
                uniqueId: 'dec-1',
                type: 'deployment',
                target: ['/api/calm/namespaces/my-namespace/architectures/my-arch/versions/1-0-0'],
                appliesTo: ['node-a'],
                data: {
                    status: 'completed',
                    'start-time': '2024-01-01T10:00:00Z',
                    'end-time': '2024-01-01T10:05:00Z',
                },
            }];
            mock.onGet(`/api/calm/namespaces/${namespace}/decorators/values?target=node-a&type=deployment`).reply(200, {
                values: decorators,
            });
            const actual = await calmService.fetchDecoratorValues(namespace, 'node-a', 'deployment');
            expect(actual).toEqual(decorators);
        });

        it('should return an empty array when backend returns error status', async () => {
            mock.onGet(`/api/calm/namespaces/${namespace}/decorators/values`).reply(500, {
                message: 'Error',
            });
            const actual = await calmService.fetchDecoratorValues(namespace);
            expect(actual).toEqual([]);
        });
    });

    describe('fetchMappings', () => {
        it('should retrieve all named resources for a type in a namespace', async () => {
            const mappings = [
                { namespace: 'test-namespace', customId: 'api-gateway', resourceType: 'PATTERN', numericId: 1 },
                { namespace: 'test-namespace', customId: 'other-pattern', resourceType: 'PATTERN', numericId: 2 },
            ];
            mock.onGet('/calm/namespaces/test-namespace/patterns').reply(200, { values: mappings });
            const actual = await calmService.fetchMappings(namespace, 'PATTERN');
            expect(actual).toEqual(mappings);
        });

        it('should return empty array when no type provided', async () => {
            const actual = await calmService.fetchMappings(namespace);
            expect(actual).toEqual([]);
        });

        it('should return empty array on error', async () => {
            mock.onGet('/calm/namespaces/test-namespace/patterns').reply(500, { message: 'Error' });
            const actual = await calmService.fetchMappings(namespace, 'PATTERN');
            expect(actual).toEqual([]);
        });
    });

    describe('fetchVersionsByCustomId', () => {
        it('should retrieve versions for a custom ID', async () => {
            const versions = ['1.0.0', '1.1.0'];
            mock.onGet('/calm/namespaces/test-namespace/patterns/api-gateway/versions').reply(200, { values: versions });
            const actual = await calmService.fetchVersionsByCustomId(namespace, 'api-gateway', 'Patterns');
            expect(actual).toEqual(versions);
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet('/calm/namespaces/test-namespace/patterns/api-gateway/versions').reply(404, { message: 'Not found' });
            await expect(calmService.fetchVersionsByCustomId(namespace, 'api-gateway', 'Patterns')).rejects.toThrowError();
        });
    });

    describe('fetchResourceByCustomId', () => {
        it('should retrieve a resource by custom ID and version', async () => {
            const resourceData = { name: 'API Gateway Pattern' };
            mock.onGet('/calm/namespaces/test-namespace/patterns/api-gateway/versions/1.0.0').reply(200, resourceData);
            const actual = await calmService.fetchResourceByCustomId(namespace, 'api-gateway', '1.0.0', 'Patterns');
            expect(actual).toEqual({
                id: 'api-gateway',
                version: '1.0.0',
                calmType: 'Patterns',
                name: namespace,
                data: resourceData,
            });
        });

        it('should throw an error when backend returns error status', async () => {
            mock.onGet('/calm/namespaces/test-namespace/patterns/api-gateway/versions/1.0.0').reply(404, { message: 'Not found' });
            await expect(calmService.fetchResourceByCustomId(namespace, 'api-gateway', '1.0.0', 'Patterns')).rejects.toThrowError();
        });
    });

    describe('fetchDeploymentDecoratorsForArchitecture', () => {
        const decorators = [
            {
                uniqueId: 'dec-1',
                type: 'deployment',
                target: ['/api/calm/namespaces/test-namespace/architectures/1/versions/1-0-0'],
                appliesTo: ['node-a'],
                data: { status: 'completed' },
            },
        ];

        it('should fetch decorators using the numeric id directly without calling mappings', async () => {
            const target = `/api/calm/namespaces/${namespace}/architectures/1/versions/1-0-0`;
            mock.onGet(
                `/api/calm/namespaces/${namespace}/decorators/values?target=${encodeURIComponent(target)}&type=deployment`
            ).reply(200, { values: decorators });

            const actual = await calmService.fetchDeploymentDecoratorsForArchitecture(namespace, '1', '1.0.0');

            expect(actual).toEqual(decorators);
            // Verify no mapping call was made (numeric id needs no resolution)
            expect(mock.history.get.filter((r) => r.url?.includes('/calm/namespaces/') && r.url?.includes('/architectures') && !r.url?.includes('/decorators'))).toHaveLength(0);
        });

        it('should resolve a slug id to its numeric id via mappings before fetching decorators', async () => {
            const mappings = [
                { namespace, customId: 'my-arch', resourceType: 'ARCHITECTURE', numericId: 42 },
            ];
            mock.onGet(`/calm/namespaces/${namespace}/architectures`).reply(200, { values: mappings });

            const target = `/api/calm/namespaces/${namespace}/architectures/42/versions/1-0-0`;
            mock.onGet(
                `/api/calm/namespaces/${namespace}/decorators/values?target=${encodeURIComponent(target)}&type=deployment`
            ).reply(200, { values: decorators });

            const actual = await calmService.fetchDeploymentDecoratorsForArchitecture(namespace, 'my-arch', '1.0.0');

            expect(actual).toEqual(decorators);
        });

        it('should return empty array when the slug cannot be resolved in the mappings', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/architectures`).reply(200, { values: [] });

            const actual = await calmService.fetchDeploymentDecoratorsForArchitecture(namespace, 'unknown-slug', '1.0.0');

            expect(actual).toEqual([]);
        });

        it('should replace dots in the version with hyphens in the target path', async () => {
            const target = `/api/calm/namespaces/${namespace}/architectures/5/versions/2-3-1`;
            mock.onGet(
                `/api/calm/namespaces/${namespace}/decorators/values?target=${encodeURIComponent(target)}&type=deployment`
            ).reply(200, { values: [] });

            const actual = await calmService.fetchDeploymentDecoratorsForArchitecture(namespace, '5', '2.3.1');

            expect(actual).toEqual([]);
        });
    });

    describe('resolveArchitectureVersionTarget', () => {
        it('builds the exact version target from a numeric id without calling mappings', async () => {
            expect(await calmService.resolveArchitectureVersionTarget(namespace, '7', '1.1.0'))
                .toBe(`/api/calm/namespaces/${namespace}/architectures/7/versions/1-1-0`);
            expect(mock.history.get).toHaveLength(0);
        });

        it('resolves a slug to its numeric id through the mappings', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/architectures`).reply(200, { values: [{ namespace, customId: 'my-arch', resourceType: 'ARCHITECTURE', numericId: 42 }] });
            expect(await calmService.resolveArchitectureVersionTarget(namespace, 'my-arch', '1.0.0'))
                .toBe(`/api/calm/namespaces/${namespace}/architectures/42/versions/1-0-0`);
        });

        it('returns undefined when the slug cannot be resolved', async () => {
            mock.onGet(`/calm/namespaces/${namespace}/architectures`).reply(200, { values: [] });
            expect(await calmService.resolveArchitectureVersionTarget(namespace, 'unknown-slug', '1.0.0')).toBeUndefined();
        });
    });

    describe('fetchControlEvaluationDecorators', () => {
        const target = `/api/calm/namespaces/${namespace}/architectures/7/versions/1-1-0`;

        it('fetches control-evaluation decorators for an exact version target', async () => {
            const values = [{ uniqueId: 'eval-1', type: 'control-evaluation', target: [target], appliesTo: ['trade-api'], data: { status: 'not-met' } }];
            mock.onGet(`/api/calm/namespaces/${namespace}/decorators/values?target=${encodeURIComponent(target)}&type=control-evaluation`).reply(200, { values });
            expect(await calmService.fetchControlEvaluationDecorators(namespace, target)).toEqual(values);
        });

        it('rejects when the hub fails, so a failed refresh is not mistaken for no evaluations', async () => {
            mock.onGet(new RegExp('/decorators/values')).reply(500);
            await expect(calmService.fetchControlEvaluationDecorators(namespace, target)).rejects.toThrow(/control-evaluation/);
        });
    });
});
