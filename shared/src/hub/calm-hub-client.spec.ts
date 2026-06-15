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
            mock.onPost('/api/calm/domains').reply(201, null, {});

            const result = await client.createDomain('risk');
            expect(result).toEqual({ name: 'risk', location: '/api/calm/domains/risk' });
        });

        it('throws HubClientError(409) on conflict', async () => {
            mock.onPost('/api/calm/domains').reply(409, { error: 'Domain already exists' });

            await expect(client.createDomain('risk')).rejects.toMatchObject({
                status: 409,
                error: 'Domain already exists',
                request: 'POST /api/calm/domains'
            });
        });
    });

    // ── listDomains ──────────────────────────────────────────────────────────

    describe('listDomains', () => {
        it('returns array of domain summaries', async () => {
            mock.onGet('/api/calm/domains').reply(200, {
                values: [{ name: 'risk' }, { name: 'compliance' }]
            });

            const result = await client.listDomains();
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('risk');
        });

        it('returns empty array when values is absent', async () => {
            mock.onGet('/api/calm/domains').reply(200, {});
            const result = await client.listDomains();
            expect(result).toEqual([]);
        });
    });

    // ── createControl ─────────────────────────────────────────────────────────

    describe('createControl', () => {
        const reqJson = JSON.stringify({ type: 'control-requirement', requirements: [] });

        it('returns id and location on 201', async () => {
            mock.onPost('/api/calm/domains/risk/controls').reply(201, null, {
                location: '/api/calm/domains/risk/controls/42'
            });

            const result = await client.createControl('risk', 'my-control', 'A control', reqJson);
            expect(result).toEqual({ id: 42, location: '/api/calm/domains/risk/controls/42' });
        });

        it('sends correct body fields including requirementJson', async () => {
            let capturedBody: unknown;
            mock.onPost('/api/calm/domains/risk/controls').reply((config) => {
                capturedBody = JSON.parse(config.data as string);
                return [201, null, { location: '/api/calm/domains/risk/controls/1' }];
            });

            await client.createControl('risk', 'my-control', 'A control', reqJson);
            expect(capturedBody).toMatchObject({ name: 'my-control', description: 'A control', requirementJson: reqJson });
        });

        it('throws HubClientError(409) on conflict', async () => {
            mock.onPost('/api/calm/domains/risk/controls').reply(409, { error: 'Control already exists' });

            await expect(client.createControl('risk', 'dup', 'desc', reqJson)).rejects.toMatchObject({
                status: 409,
                request: 'POST /api/calm/domains/risk/controls'
            });
        });
    });

    // ── listControls ──────────────────────────────────────────────────────────

    describe('listControls', () => {
        it('returns array of control summaries', async () => {
            mock.onGet('/api/calm/domains/risk/controls').reply(200, {
                values: [
                    { id: 1, name: 'control-a' },
                    { id: 2, name: 'control-b' }
                ]
            });

            const result = await client.listControls('risk');
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: 1, name: 'control-a' });
        });

        it('returns empty array when values is absent', async () => {
            mock.onGet('/api/calm/domains/risk/controls').reply(200, {});
            const result = await client.listControls('risk');
            expect(result).toEqual([]);
        });
    });

    // ── pushControlRequirement ────────────────────────────────────────────────

    describe('pushControlRequirement', () => {
        const reqName = 'access-control';
        const reqDescription = 'Access control requirement wrapper';
        const reqJson = JSON.stringify({ type: 'control-requirement', requirements: [] });

        it('returns id, version and location on 201 with Location header', async () => {
            mock.onPost('/api/calm/domains/risk/controls/1/requirement/versions/1.0.0').reply(201, null, {
                location: '/api/calm/domains/risk/controls/1/requirement/versions/1.0.0'
            });

            const result = await client.pushControlRequirement('risk', 1, '1.0.0', reqName, reqDescription, reqJson);
            expect(result).toEqual({
                id: 1,
                version: '1.0.0',
                location: '/api/calm/domains/risk/controls/1/requirement/versions/1.0.0'
            });
        });

        it('returns constructed location when header is absent', async () => {
            mock.onPost('/api/calm/domains/risk/controls/1/requirement/versions/1.0.0').reply(201, null, {});

            const result = await client.pushControlRequirement('risk', 1, '1.0.0', reqName, reqDescription, reqJson);
            expect(result.location).toBe('/api/calm/domains/risk/controls/1/requirement/versions/1.0.0');
        });

        it('sends wrapper payload with name, description and requirementJson', async () => {
            mock.onPost('/api/calm/domains/risk/controls/1/requirement/versions/1.0.0').reply(201, null, {
                location: '/api/calm/domains/risk/controls/1/requirement/versions/1.0.0'
            });

            await client.pushControlRequirement('risk', 1, '1.0.0', reqName, reqDescription, reqJson);

            expect(mock.history.post).toHaveLength(1);
            expect(JSON.parse(mock.history.post[0].data as string)).toEqual({
                name: reqName,
                description: reqDescription,
                requirementJson: reqJson
            });
        });

        it('throws HubClientError(400) on bad request', async () => {
            mock.onPost('/api/calm/domains/risk/controls/1/requirement/versions/1.0.0').reply(400, 'Bad request');
            await expect(client.pushControlRequirement('risk', 1, '1.0.0', reqName, reqDescription, reqJson)).rejects.toMatchObject({
                status: 400,
                request: 'POST /api/calm/domains/risk/controls/1/requirement/versions/1.0.0'
            });
        });
    });

    // ── pullControlRequirement ────────────────────────────────────────────────

    describe('pullControlRequirement', () => {
        it('returns the requirement detail object', async () => {
            const detail = { type: 'control-requirement', requirements: [] };
            mock.onGet('/api/calm/domains/risk/controls/1/requirement/versions/1.0.0').reply(200, detail);

            const result = await client.pullControlRequirement('risk', 1, '1.0.0');
            expect(result).toEqual(detail);
        });

        it('throws HubClientError(404) when not found', async () => {
            mock.onGet('/api/calm/domains/risk/controls/99/requirement/versions/1.0.0').reply(404, 'Not found');
            await expect(client.pullControlRequirement('risk', 99, '1.0.0')).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── pushControlConfiguration ─────────────────────────────────────────────

    describe('pushControlConfiguration', () => {
        const configJson = JSON.stringify({ type: 'control-configuration', config: {} });

        it('returns id, version and location on 201 with Location header', async () => {
            mock.onPost('/api/calm/domains/risk/controls/1/configurations/5/versions/1.0.0').reply(201, null, {
                location: '/api/calm/domains/risk/controls/1/configurations/5/versions/1.0.0'
            });

            const result = await client.pushControlConfiguration('risk', 1, 5, '1.0.0', configJson);
            expect(result).toEqual({
                id: 5,
                version: '1.0.0',
                location: '/api/calm/domains/risk/controls/1/configurations/5/versions/1.0.0'
            });
        });

        it('returns constructed location when header is absent', async () => {
            mock.onPost('/api/calm/domains/risk/controls/1/configurations/5/versions/1.0.0').reply(201, null, {});

            const result = await client.pushControlConfiguration('risk', 1, 5, '1.0.0', configJson);
            expect(result.location).toBe('/api/calm/domains/risk/controls/1/configurations/5/versions/1.0.0');
        });

        it('sends wrapper payload with configurationJson', async () => {
            mock.onPost('/api/calm/domains/risk/controls/1/configurations/5/versions/1.0.0').reply(201, null, {
                location: '/api/calm/domains/risk/controls/1/configurations/5/versions/1.0.0'
            });

            await client.pushControlConfiguration('risk', 1, 5, '1.0.0', configJson);

            expect(mock.history.post).toHaveLength(1);
            expect(JSON.parse(mock.history.post[0].data as string)).toEqual({
                configurationJson: configJson
            });
        });

        it('throws HubClientError(400) on bad request', async () => {
            mock.onPost('/api/calm/domains/risk/controls/1/configurations/5/versions/1.0.0').reply(400, 'Bad request');
            await expect(client.pushControlConfiguration('risk', 1, 5, '1.0.0', configJson)).rejects.toMatchObject({
                status: 400,
                request: 'POST /api/calm/domains/risk/controls/1/configurations/5/versions/1.0.0'
            });
        });
    });

    // ── pullControlConfiguration ─────────────────────────────────────────────

    describe('pullControlConfiguration', () => {
        it('returns the config detail object', async () => {
            const detail = { type: 'control-configuration', config: {} };
            mock.onGet('/api/calm/domains/risk/controls/1/configurations/5/versions/1.0.0').reply(200, detail);

            const result = await client.pullControlConfiguration('risk', 1, 5, '1.0.0');
            expect(result).toEqual(detail);
        });

        it('throws HubClientError(404) when not found', async () => {
            mock.onGet('/api/calm/domains/risk/controls/99/configurations/5/versions/1.0.0').reply(404, 'Not found');
            await expect(client.pullControlConfiguration('risk', 99, 5, '1.0.0')).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── createControlConfiguration ────────────────────────────────────────────

    describe('createControlConfiguration', () => {
        const configJson = JSON.stringify({ type: 'control-configuration', config: {} });

        it('returns id and location on 201 with Location header', async () => {
            mock.onPost('/api/calm/domains/risk/controls/1/configurations').reply(201, null, {
                location: '/api/calm/domains/risk/controls/1/configurations/5'
            });

            const result = await client.createControlConfiguration('risk', 1, configJson);
            expect(result).toEqual({
                id: 5,
                location: '/api/calm/domains/risk/controls/1/configurations/5'
            });
        });

        it('throws HubClientError(404) when control not found', async () => {
            mock.onPost('/api/calm/domains/risk/controls/99/configurations').reply(404, 'Not found');
            await expect(client.createControlConfiguration('risk', 99, configJson)).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── listControlConfigurations ─────────────────────────────────────────────

    describe('listControlConfigurations', () => {
        it('returns list of config IDs', async () => {
            mock.onGet('/api/calm/domains/risk/controls/1/configurations').reply(200, { values: [1, 2, 3] });

            const result = await client.listControlConfigurations('risk', 1);
            expect(result).toEqual([1, 2, 3]);
        });

        it('returns empty array when no configurations', async () => {
            mock.onGet('/api/calm/domains/risk/controls/1/configurations').reply(200, { values: [] });

            const result = await client.listControlConfigurations('risk', 1);
            expect(result).toEqual([]);
        });

        it('throws HubClientError(404) when control not found', async () => {
            mock.onGet('/api/calm/domains/risk/controls/99/configurations').reply(404, 'Not found');
            await expect(client.listControlConfigurations('risk', 99)).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── listControlRequirementVersions ────────────────────────────────────────

    describe('listControlRequirementVersions', () => {
        it('returns list of version strings', async () => {
            mock.onGet('/api/calm/domains/risk/controls/1/requirement/versions').reply(200, { values: ['1.0.0', '2.0.0'] });

            const result = await client.listControlRequirementVersions('risk', 1);
            expect(result).toEqual(['1.0.0', '2.0.0']);
        });

        it('returns empty array when no versions', async () => {
            mock.onGet('/api/calm/domains/risk/controls/1/requirement/versions').reply(200, { values: [] });

            const result = await client.listControlRequirementVersions('risk', 1);
            expect(result).toEqual([]);
        });

        it('throws HubClientError(404) when control not found', async () => {
            mock.onGet('/api/calm/domains/risk/controls/99/requirement/versions').reply(404, 'Not found');
            await expect(client.listControlRequirementVersions('risk', 99)).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── listControlRequirements ───────────────────────────────────────────────

    describe('listControlRequirements', () => {
        it('returns control requirements with versions', async () => {
            mock.onGet('/api/calm/domains/risk/controls').reply(200, {
                values: [
                    { id: 20, name: 'Encryption At Rest Requirement Updated', description: 'Updated control for encryption at rest' },
                    { id: 21, name: 'Data Retention Requirement', description: 'Control for data retention' }
                ]
            });
            mock.onGet('/api/calm/domains/risk/controls/20/requirement/versions').reply(200, { values: ['1.0.0'] });
            mock.onGet('/api/calm/domains/risk/controls/21/requirement/versions').reply(200, { values: ['1.0.0', '2.0.0'] });

            const result = await client.listControlRequirements('risk');

            expect(result).toEqual([
                {
                    'control-id': 20,
                    name: 'Encryption At Rest Requirement Updated',
                    description: 'Updated control for encryption at rest',
                    versions: ['1.0.0']
                },
                {
                    'control-id': 21,
                    name: 'Data Retention Requirement',
                    description: 'Control for data retention',
                    versions: ['1.0.0', '2.0.0']
                }
            ]);
        });

        it('returns empty array when no controls exist', async () => {
            mock.onGet('/api/calm/domains/risk/controls').reply(200, { values: [] });

            const result = await client.listControlRequirements('risk');

            expect(result).toEqual([]);
        });

        it('includes controls with empty version lists', async () => {
            mock.onGet('/api/calm/domains/risk/controls').reply(200, {
                values: [{ id: 22, name: 'Logging Requirement', description: 'Control for logging' }]
            });
            mock.onGet('/api/calm/domains/risk/controls/22/requirement/versions').reply(200, { values: [] });

            const result = await client.listControlRequirements('risk');

            expect(result).toEqual([
                {
                    'control-id': 22,
                    name: 'Logging Requirement',
                    description: 'Control for logging',
                    versions: []
                }
            ]);
        });

        it('fails when listing controls fails', async () => {
            mock.onGet('/api/calm/domains/risk/controls').reply(500, { error: 'Internal server error' });

            await expect(client.listControlRequirements('risk')).rejects.toMatchObject({
                status: 500,
                request: 'GET /api/calm/domains/risk/controls'
            });
        });

        it('fails when one control version lookup fails', async () => {
            mock.onGet('/api/calm/domains/risk/controls').reply(200, {
                values: [
                    { id: 20, name: 'Encryption At Rest Requirement Updated', description: 'Updated control for encryption at rest' },
                    { id: 21, name: 'Data Retention Requirement', description: 'Control for data retention' }
                ]
            });
            mock.onGet('/api/calm/domains/risk/controls/20/requirement/versions').reply(200, { values: ['1.0.0'] });
            mock.onGet('/api/calm/domains/risk/controls/21/requirement/versions').reply(404, 'Not found');

            await expect(client.listControlRequirements('risk')).rejects.toMatchObject({
                status: 404,
                request: 'GET /api/calm/domains/risk/controls/21/requirement/versions'
            });
        });
    });

    // ── listControlConfigurationVersions ─────────────────────────────────────

    describe('listControlConfigurationVersions', () => {
        it('returns list of version strings', async () => {
            mock.onGet('/api/calm/domains/risk/controls/1/configurations/5/versions').reply(200, { values: ['1.0.0', '2.0.0'] });

            const result = await client.listControlConfigurationVersions('risk', 1, 5);
            expect(result).toEqual(['1.0.0', '2.0.0']);
        });

        it('returns empty array when no versions', async () => {
            mock.onGet('/api/calm/domains/risk/controls/1/configurations/5/versions').reply(200, { values: [] });

            const result = await client.listControlConfigurationVersions('risk', 1, 5);
            expect(result).toEqual([]);
        });

        it('throws HubClientError(404) when configuration not found', async () => {
            mock.onGet('/api/calm/domains/risk/controls/1/configurations/99/versions').reply(404, 'Not found');
            await expect(client.listControlConfigurationVersions('risk', 1, 99)).rejects.toMatchObject({ status: 404 });
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
            authMock.onPost('/api/calm/domains').reply(201, null, {});

            await authClient.createDomain('risk');
            expect(getAuthHeaders).toHaveBeenCalled();
        });

        it('injects auth headers on listDomains', async () => {
            authMock.onGet('/api/calm/domains').reply(200, { values: [] });

            await authClient.listDomains();
            expect(getAuthHeaders).toHaveBeenCalled();
        });

        it('injects auth headers on pushControlRequirement', async () => {
            authMock.onPost('/api/calm/domains/risk/controls/1/requirement/versions/1.0.0').reply(201, null, {
                location: '/api/calm/domains/risk/controls/1/requirement/versions/1.0.0'
            });

            await authClient.pushControlRequirement('risk', 1, '1.0.0', 'req-name', 'req-description', '{}');
            expect(getAuthHeaders).toHaveBeenCalled();
        });

        it('injects auth headers on pullControlConfiguration', async () => {
            authMock.onGet('/api/calm/domains/risk/controls/1/configurations/5/versions/1.0.0').reply(200, {});

            await authClient.pullControlConfiguration('risk', 1, 5, '1.0.0');
            expect(getAuthHeaders).toHaveBeenCalled();
        });
    });
});
