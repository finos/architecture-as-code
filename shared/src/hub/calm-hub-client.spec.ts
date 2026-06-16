import { AuthPlugin } from '../auth/auth-plugin';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { CalmHubClient, HubClientError } from './calm-hub-client';
import { DocumentMetadata } from './document-id-utils';

describe('CalmHubClient', () => {
    let mock: AxiosMockAdapter;
    let client: CalmHubClient;

    beforeEach(() => {
        const ax = axios.create({ baseURL: 'http://localhost:8080' });
        mock = new AxiosMockAdapter(ax);
        client = new CalmHubClient({ calmHubUrl: 'http://localhost:8080' }, ax);
    });

    // ── createNamespace ──────────────────────────────────────────────────────

    describe('createNamespace', () => {
        it('returns name and location on 201', async () => {
            mock.onPost('/api/calm/namespaces').reply(201, null, {
                location: '/api/calm/namespaces/my-org'
            });

            const result = await client.createNamespace('my-org', 'My organisation');
            expect(result.name).toBe('my-org');
            expect(result.location).toBe('/api/calm/namespaces/my-org');
        });

        it('falls back to constructed location when header is absent', async () => {
            mock.onPost('/api/calm/namespaces').reply(201, null, {});

            const result = await client.createNamespace('my-org', 'My organisation');
            expect(result.location).toBe('/api/calm/namespaces/my-org');
        });

        it('throws HubClientError(409) on conflict', async () => {
            mock.onPost('/api/calm/namespaces').reply(409, { error: 'Namespace already exists' });

            await expect(client.createNamespace('my-org', 'My organisation')).rejects.toMatchObject({
                status: 409,
                error: 'Namespace already exists',
                request: 'POST /api/calm/namespaces'
            });
        });

        it('throws HubClientError on network failure', async () => {
            mock.onPost('/api/calm/namespaces').networkError();

            await expect(client.createNamespace('my-org', 'My organisation')).rejects.toBeInstanceOf(HubClientError);
        });
    });

    // ── listNamespaces ───────────────────────────────────────────────────────

    describe('listNamespaces', () => {
        it('returns array of namespace summaries', async () => {
            mock.onGet('/api/calm/namespaces').reply(200, {
                values: [
                    { name: 'finos', description: 'FINOS' },
                    { name: 'my-org', description: '' }
                ]
            });

            const result = await client.listNamespaces();
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('finos');
        });

        it('returns empty array when values is absent', async () => {
            mock.onGet('/api/calm/namespaces').reply(200, {});
            const result = await client.listNamespaces();
            expect(result).toEqual([]);
        });

        it('throws HubClientError on 500', async () => {
            mock.onGet('/api/calm/namespaces').reply(500, 'System Malfunction');

            await expect(client.listNamespaces()).rejects.toMatchObject({
                status: 500,
                request: 'GET /api/calm/namespaces'
            });
        });
    });

    // ── auth plugin ──────────────────────────────────────────────────────────

    describe('auth plugin', () => {
        let authClient: CalmHubClient;
        let authMock: AxiosMockAdapter;
        let getAuthHeaders: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            getAuthHeaders = vi.fn().mockResolvedValue({ Authorization: 'Bearer test-token' });
            const ax = axios.create({ baseURL: 'http://localhost:8080' });
            authMock = new AxiosMockAdapter(ax);
            authClient = new CalmHubClient(
                { calmHubUrl: 'http://localhost:8080', authPlugin: { getAuthHeaders } as unknown as AuthPlugin },
                ax
            );
        });

        it('injects auth headers on createNamespace', async () => {
            authMock.onPost('/api/calm/namespaces').reply(201, null, { location: '/api/calm/namespaces/my-org' });

            await authClient.createNamespace('my-org', 'My org');

            expect(getAuthHeaders).toHaveBeenCalledOnce();
            const [url] = getAuthHeaders.mock.calls[0];
            expect(url).toContain('/api/calm/namespaces');
            expect(authMock.history.post[0].headers?.Authorization).toBe('Bearer test-token');
        });

        it('injects auth headers on listNamespaces', async () => {
            authMock.onGet('/api/calm/namespaces').reply(200, { values: [] });

            await authClient.listNamespaces();

            expect(getAuthHeaders).toHaveBeenCalledOnce();
            expect(authMock.history.get[0].headers?.Authorization).toBe('Bearer test-token');
        });

        it('does not call getAuthHeaders when no auth plugin is configured', async () => {
            mock.onGet('/api/calm/namespaces').reply(200, { values: [] });

            await client.listNamespaces();

            expect(getAuthHeaders).not.toHaveBeenCalled();
        });

        it('passes the request body to getAuthHeaders', async () => {
            const body = { name: 'my-org', description: 'My org' };
            authMock.onPost('/api/calm/namespaces').reply(201, null, { location: '/api/calm/namespaces/my-org' });

            await authClient.createNamespace('my-org', 'My org');

            const [, requestBody] = getAuthHeaders.mock.calls[0];
            expect(requestBody).toMatchObject(body);
        });
    });

    // ── createDomain ─────────────────────────────────────────────────────────

    describe('createDomain', () => {
        it('returns name and location on 201', async () => {
            mock.onPost('/calm/domains').reply(201, null, {});

            const result = await client.createDomain('risk');
            expect(result).toEqual({ name: 'risk', location: '/calm/domains/risk' });
        });

        it('throws HubClientError(409) on conflict', async () => {
            mock.onPost('/calm/domains').reply(409, { error: 'Domain already exists' });

            await expect(client.createDomain('risk')).rejects.toMatchObject({
                status: 409,
                error: 'Domain already exists',
                request: 'POST /calm/domains'
            });
        });
    });

    // ── listDomains ──────────────────────────────────────────────────────────

    describe('listDomains', () => {
        it('returns array of domain summaries', async () => {
            mock.onGet('/calm/domains').reply(200, {
                values: [{ name: 'risk' }, { name: 'compliance' }]
            });

            const result = await client.listDomains();
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('risk');
        });

        it('returns empty array when values is absent', async () => {
            mock.onGet('/calm/domains').reply(200, {});
            const result = await client.listDomains();
            expect(result).toEqual([]);
        });
    });

    // ── listControls ───────────────────────────────────────────────────────────

    describe('listControls', () => {
        it('returns the control summaries for a domain', async () => {
            mock.onGet('/calm/domains/security/controls').reply(200, {
                values: [
                    { id: 19, name: 'rate-limit', description: 'rate limit is needed' },
                    { id: 20, name: 'encryption' }
                ]
            });

            const result = await client.listControls('security');
            expect(result).toEqual([
                { id: 19, name: 'rate-limit', description: 'rate limit is needed' },
                { id: 20, name: 'encryption' }
            ]);
        });

        it('returns empty array when values is absent', async () => {
            mock.onGet('/calm/domains/security/controls').reply(200, {});
            const result = await client.listControls('security');
            expect(result).toEqual([]);
        });

        it('throws HubClientError on 500', async () => {
            mock.onGet('/calm/domains/security/controls').reply(500, 'System Malfunction');
            await expect(client.listControls('security')).rejects.toMatchObject({
                status: 500,
                request: 'GET /calm/domains/security/controls'
            });
        });
    });

    // ── listControlConfigurations ──────────────────────────────────────────────

    describe('listControlConfigurations', () => {
        it('returns the configuration summaries for a control', async () => {
            mock.onGet('/calm/domains/security/controls/access-control/configurations').reply(200, {
                values: [{ id: 1, name: 'prod' }, { id: 2, name: 'dev' }]
            });

            const result = await client.listControlConfigurations('security', 'access-control');
            expect(result).toEqual([{ id: 1, name: 'prod' }, { id: 2, name: 'dev' }]);
        });

        it('returns empty array when values is absent', async () => {
            mock.onGet('/calm/domains/security/controls/access-control/configurations').reply(200, {});
            const result = await client.listControlConfigurations('security', 'access-control');
            expect(result).toEqual([]);
        });
    });

    // ── control requirement versions ───────────────────────────────────────────

    describe('getControlRequirementVersions', () => {
        const endpoint = '/calm/domains/security/controls/access-control/requirement/versions';

        it('returns the array of versions', async () => {
            mock.onGet(endpoint).reply(200, { values: ['1.0.0', '2.0.0'] });
            expect(await client.getControlRequirementVersions('security', 'access-control')).toEqual(['1.0.0', '2.0.0']);
        });

        it('returns empty array when the requirement has no versions yet', async () => {
            mock.onGet(endpoint).reply(200, {});
            expect(await client.getControlRequirementVersions('security', 'access-control')).toEqual([]);
        });

        it('throws HubClientError on 500', async () => {
            mock.onGet(endpoint).reply(500, 'System Malfunction');
            await expect(client.getControlRequirementVersions('security', 'access-control')).rejects.toMatchObject({
                status: 500,
                request: `GET ${endpoint}`
            });
        });
    });

    describe('getControlRequirementVersion', () => {
        const endpoint = '/calm/domains/security/controls/access-control/requirement/versions/1.0.0';

        it('returns the requirement document at the requested version', async () => {
            mock.onGet(endpoint).reply(200, { 'control-id': 'access-control' });
            expect(await client.getControlRequirementVersion('security', 'access-control', '1.0.0')).toEqual({ 'control-id': 'access-control' });
        });

        it('throws HubClientError(404) when the version does not exist', async () => {
            mock.onGet(endpoint).reply(404, 'Not found');
            await expect(client.getControlRequirementVersion('security', 'access-control', '1.0.0')).rejects.toMatchObject({
                status: 404,
                request: `GET ${endpoint}`
            });
        });
    });

    describe('createControlRequirementVersion', () => {
        const endpoint = '/calm/domains/security/controls/access-control/requirement/versions/1.0.0';
        const json = JSON.stringify({ $id: 'http://localhost:8080' + endpoint, nodes: [] });

        it('posts the raw document and returns the location header', async () => {
            mock.onPost(endpoint).reply(201, null, { location: 'http://localhost:8080' + endpoint });

            const result = await client.createControlRequirementVersion('security', 'access-control', '1.0.0', json);
            expect(result).toBe('http://localhost:8080' + endpoint);
            expect(mock.history.post[0].data).toBe(json);
        });

        it('throws HubClientError(409) when the version already exists', async () => {
            mock.onPost(endpoint).reply(409, { error: 'Version already exists' });
            await expect(client.createControlRequirementVersion('security', 'access-control', '1.0.0', json)).rejects.toMatchObject({
                status: 409,
                error: 'Version already exists',
                request: `POST ${endpoint}`
            });
        });
    });

    // ── control configuration versions ─────────────────────────────────────────

    describe('getControlConfigurationVersions', () => {
        const endpoint = '/calm/domains/security/controls/access-control/configurations/prod/versions';

        it('returns the array of versions', async () => {
            mock.onGet(endpoint).reply(200, { values: ['1.0.0'] });
            expect(await client.getControlConfigurationVersions('security', 'access-control', 'prod')).toEqual(['1.0.0']);
        });

        it('returns empty array when the configuration has no versions yet', async () => {
            mock.onGet(endpoint).reply(200, {});
            expect(await client.getControlConfigurationVersions('security', 'access-control', 'prod')).toEqual([]);
        });

        it('throws HubClientError on 500', async () => {
            mock.onGet(endpoint).reply(500, 'System Malfunction');
            await expect(client.getControlConfigurationVersions('security', 'access-control', 'prod')).rejects.toMatchObject({
                status: 500,
                request: `GET ${endpoint}`
            });
        });
    });

    describe('getControlConfigurationVersion', () => {
        const endpoint = '/calm/domains/security/controls/access-control/configurations/prod/versions/1.0.0';

        it('returns the configuration document at the requested version', async () => {
            mock.onGet(endpoint).reply(200, { nodes: [] });
            expect(await client.getControlConfigurationVersion('security', 'access-control', 'prod', '1.0.0')).toEqual({ nodes: [] });
        });

        it('throws HubClientError(404) when the version does not exist', async () => {
            mock.onGet(endpoint).reply(404, 'Not found');
            await expect(client.getControlConfigurationVersion('security', 'access-control', 'prod', '1.0.0')).rejects.toMatchObject({
                status: 404,
                request: `GET ${endpoint}`
            });
        });
    });

    describe('createControlConfigurationVersion', () => {
        const endpoint = '/calm/domains/security/controls/access-control/configurations/prod/versions/1.0.0';
        const json = JSON.stringify({ $id: 'http://localhost:8080' + endpoint, nodes: [] });

        it('posts the raw document and returns the location header', async () => {
            mock.onPost(endpoint).reply(201, null, { location: 'http://localhost:8080' + endpoint });

            const result = await client.createControlConfigurationVersion('security', 'access-control', 'prod', '1.0.0', json);
            expect(result).toBe('http://localhost:8080' + endpoint);
            expect(mock.history.post[0].data).toBe(json);
        });

        it('throws HubClientError(409) when the version already exists', async () => {
            mock.onPost(endpoint).reply(409, { error: 'Version already exists' });
            await expect(client.createControlConfigurationVersion('security', 'access-control', 'prod', '1.0.0', json)).rejects.toMatchObject({
                status: 409,
                error: 'Version already exists',
                request: `POST ${endpoint}`
            });
        });
    });

    // ── getNamespaceMappings ──────────────────────────────────────────────────

    describe('getNamespaceMappings', () => {
        it('returns the array of mapped resource ids for the given type', async () => {
            mock.onGet('/calm/namespaces/finos/architectures').reply(200, {
                values: ['my-arch', 'another-arch']
            });

            const result = await client.getNamespaceMappings('finos', 'architectures');
            expect(result).toEqual(['my-arch', 'another-arch']);
        });

        it('returns empty array when values is absent', async () => {
            mock.onGet('/calm/namespaces/finos/patterns').reply(200, {});
            const result = await client.getNamespaceMappings('finos', 'patterns');
            expect(result).toEqual([]);
        });

        it('targets the type-scoped endpoint with the resource type in the path', async () => {
            mock.onGet('/calm/namespaces/finos/standards').reply(200, { values: [] });

            await client.getNamespaceMappings('finos', 'standards');
            expect(mock.history.get[0].url).toBe('/calm/namespaces/finos/standards');
        });

        it('throws HubClientError on 500', async () => {
            mock.onGet('/calm/namespaces/finos/architectures').reply(500, 'System Malfunction');

            await expect(client.getNamespaceMappings('finos', 'architectures')).rejects.toMatchObject({
                status: 500,
                request: 'GET /calm/namespaces/finos/architectures'
            });
        });
    });

    // ── createNewMappedResource ───────────────────────────────────────────────

    describe('createMappedResourceVersion', () => {
        const documentId = 'http://localhost:8080/calm/namespaces/finos/architectures/my-arch/versions/1.0.0';
        const endpoint = '/calm/namespaces/finos/architectures/my-arch/versions/1.0.0';
        const metadata: DocumentMetadata = {
            rawDocumentId: documentId,
            baseUrl: 'http://localhost:8080',
            namespace: 'finos',
            mapping: 'my-arch',
            type: 'architectures',
            version: '1.0.0',
            name: 'My Arch',
            description: 'A desc'
        };
        // A document whose extracted metadata matches `metadata` exactly, so validateDocumentId passes.
        const json = JSON.stringify({ $id: documentId, title: 'My Arch', description: 'A desc', nodes: [] });

        it('posts the document to the versioned endpoint and returns the location header', async () => {
            mock.onPost(endpoint).reply(201, null, { location: documentId });

            const result = await client.createMappedResourceVersion(metadata, json);
            expect(result).toBe(documentId);
            expect(mock.history.post[0].data).toBe(json);
        });

        it('throws when the document metadata does not match the requested metadata', async () => {
            const mismatched: DocumentMetadata = { ...metadata, version: '2.0.0' };

            await expect(client.createMappedResourceVersion(mismatched, json)).rejects.toBeInstanceOf(HubClientError);
        });

        it('throws HubClientError(409) when the version already exists', async () => {
            mock.onPost(endpoint).reply(409, { error: 'Version already exists' });

            await expect(client.createMappedResourceVersion(metadata, json)).rejects.toMatchObject({
                status: 409,
                error: 'Version already exists',
                request: `POST ${endpoint}`
            });
        });

        it('throws HubClientError on network failure', async () => {
            mock.onPost(endpoint).networkError();

            await expect(client.createMappedResourceVersion(metadata, json)).rejects.toBeInstanceOf(HubClientError);
        });
    });

    // ── getMappedResourceVersions ─────────────────────────────────────────────

    describe('getMappedResourceVersions', () => {
        it('returns the array of versions', async () => {
            mock.onGet('/calm/namespaces/finos/architectures/my-arch/versions').reply(200, {
                values: ['1.0.0', '2.0.0']
            });

            const result = await client.getMappedResourceVersions('finos', 'my-arch', 'architectures');
            expect(result).toEqual(['1.0.0', '2.0.0']);
        });

        it('returns empty array when the mapping has no versions yet', async () => {
            mock.onGet('/calm/namespaces/finos/architectures/my-arch/versions').reply(200, {});
            const result = await client.getMappedResourceVersions('finos', 'my-arch', 'architectures');
            expect(result).toEqual([]);
        });

        it('throws HubClientError on 500', async () => {
            mock.onGet('/calm/namespaces/finos/architectures/my-arch/versions').reply(500, 'System Malfunction');

            await expect(client.getMappedResourceVersions('finos', 'my-arch', 'architectures')).rejects.toMatchObject({
                status: 500,
                request: 'GET /calm/namespaces/finos/architectures/my-arch/versions'
            });
        });
    });

    // ── getMappedResourceLatestVersion ────────────────────────────────────────

    describe('getMappedResourceLatestVersion', () => {
        it('returns the latest version document', async () => {
            mock.onGet('/calm/namespaces/finos/architectures/my-arch').reply(200, { nodes: [] });

            const result = await client.getMappedResourceLatestVersion('finos', 'my-arch', 'architectures');
            expect(result).toEqual({ nodes: [] });
        });

        it('throws HubClientError(404) when the mapping does not exist', async () => {
            mock.onGet('/calm/namespaces/finos/architectures/missing').reply(404, 'Not found');

            await expect(client.getMappedResourceLatestVersion('finos', 'missing', 'architectures')).rejects.toMatchObject({
                status: 404,
                request: 'GET /calm/namespaces/finos/architectures/missing'
            });
        });
    });

    // ── getMappedResourceByVersion ────────────────────────────────────────────

    describe('getMappedResourceByVersion', () => {
        it('returns the document for the requested version', async () => {
            mock.onGet('/calm/namespaces/finos/architectures/my-arch/versions/1.0.0').reply(200, { nodes: [] });

            const result = await client.getMappedResourceByVersion('finos', 'my-arch', '1.0.0', 'architectures');
            expect(result).toEqual({ nodes: [] });
        });

        it('throws HubClientError(404) when the version does not exist', async () => {
            mock.onGet('/calm/namespaces/finos/architectures/my-arch/versions/9.9.9').reply(404, 'Not found');

            await expect(client.getMappedResourceByVersion('finos', 'my-arch', '9.9.9', 'architectures')).rejects.toMatchObject({
                status: 404,
                request: 'GET /calm/namespaces/finos/architectures/my-arch/versions/9.9.9'
            });
        });
    });

    // ── auth plugin: domains/controls ─────────────────────────────────────────

    describe('auth plugin: domains/controls', () => {
        let authMock: AxiosMockAdapter;
        let authClient: CalmHubClient;
        let getAuthHeaders: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            getAuthHeaders = vi.fn().mockResolvedValue({ Authorization: 'Bearer test-token' });
            const authPlugin = { getAuthHeaders } as unknown as AuthPlugin;
            const ax = axios.create({ baseURL: 'http://localhost:8080' });
            authMock = new AxiosMockAdapter(ax);
            authClient = new CalmHubClient({ calmHubUrl: 'http://localhost:8080', authPlugin }, ax);
        });

        it('injects auth headers on createDomain', async () => {
            authMock.onPost('/calm/domains').reply(201, null, {});

            await authClient.createDomain('risk');
            expect(getAuthHeaders).toHaveBeenCalled();
        });

        it('injects auth headers on listDomains', async () => {
            authMock.onGet('/calm/domains').reply(200, { values: [] });

            await authClient.listDomains();
            expect(getAuthHeaders).toHaveBeenCalled();
        });

        it('injects auth headers on createControlRequirementVersion', async () => {
            authMock.onPost('/calm/domains/risk/controls/access-control/requirement/versions/1.0.0').reply(201, null, {
                location: '/calm/domains/risk/controls/access-control/requirement/versions/1.0.0'
            });

            await authClient.createControlRequirementVersion('risk', 'access-control', '1.0.0', '{}');
            expect(getAuthHeaders).toHaveBeenCalled();
        });

        it('injects auth headers on getControlConfigurationVersion', async () => {
            authMock.onGet('/calm/domains/risk/controls/access-control/configurations/prod/versions/1.0.0').reply(200, {});

            await authClient.getControlConfigurationVersion('risk', 'access-control', 'prod', '1.0.0');
            expect(getAuthHeaders).toHaveBeenCalled();
        });
    });
});
