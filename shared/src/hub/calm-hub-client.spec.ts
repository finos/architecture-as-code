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

    describe('narrative documents', () => {
        const request = { name: 'Payments SAD', description: 'Decisions', documentMarkdown: '---\ntitle: Payments SAD\n---\n# Payments' };

        it('does not expose the obsolete document ID lookup', () => {
            expect(client).not.toHaveProperty('getNarrativeDocumentIds');
        });

        describe.each([
            {
                name: 'create document', method: 'post',
                invoke: (client: CalmHubClient) => client.createNarrativeDocument('finos', 'sad', request),
                requestLog: 'Creating narrative document for namespace=finos with type=sad',
                responseLog: 'create narrative document', body: null,
                result: '/created', malformedResult: undefined,
            },
            {
                name: 'create version', method: 'post',
                invoke: (client: CalmHubClient) => client.createNarrativeDocumentVersion('finos', 'sad', 42, '1.0.0', request),
                requestLog: 'Creating narrative document version 1.0.0 for namespace=finos, document type=sad and id=42',
                responseLog: 'create narrative document version', body: null,
                result: '/created', malformedResult: 'error',
            },
            {
                name: 'list versions', method: 'get',
                invoke: (client: CalmHubClient) => client.getNarrativeDocumentVersions('finos', 'sad', 42),
                requestLog: 'Getting narrative document versions for namespace=finos, document type=sad and id=42',
                responseLog: 'narrative document versions', body: { values: ['1.0.0'] },
                result: ['1.0.0'], malformedResult: 'error',
            },
            {
                name: 'read version', method: 'get',
                invoke: (client: CalmHubClient) => client.getNarrativeDocumentVersion('finos', 'sad', 42, '1.0.0'),
                requestLog: 'Getting narrative document version 1.0.0 for namespace=finos, document type=sad and id=42',
                responseLog: 'narrative document version', body: { documentMarkdown: '# Payments' },
                result: { documentMarkdown: '# Payments' }, malformedResult: 'error',
            },
        ])('$name logging', ({ method, invoke, requestLog, responseLog, body, result, malformedResult }) => {
            it('logs the request before transport and the response before returning', async () => {
                const debug = vi.spyOn(client['logger'], 'debug');
                const headers = { location: '/created' };
                mock.onAny().reply(() => {
                    expect(debug.mock.calls).toEqual([[requestLog]]);
                    return [200, body, headers];
                });

                await expect(invoke(client)).resolves.toEqual(result);
                expect(debug.mock.calls).toEqual([
                    [requestLog],
                    [`Received ${responseLog} response: ${JSON.stringify(method === 'post' ? headers : body)}`],
                ]);
            });

            it('logs a received response before validating it', async () => {
                const debug = vi.spyOn(client['logger'], 'debug');
                mock.onAny().reply(200, {}, {});

                if (malformedResult === 'error') {
                    await expect(invoke(client)).rejects.toBeInstanceOf(HubClientError);
                } else {
                    await expect(invoke(client)).resolves.toBeUndefined();
                }
                expect(debug.mock.calls).toEqual([
                    [requestLog], [`Received ${responseLog} response: {}`],
                ]);
            });

            it('logs only the request when transport rejects', async () => {
                const debug = vi.spyOn(client['logger'], 'debug');
                mock.onAny().reply(500, { error: 'unavailable' });

                await expect(invoke(client)).rejects.toMatchObject({ status: 500 });
                expect(debug.mock.calls).toEqual([[requestLog]]);
            });
        });

        it('creates a narrative document using the first-class endpoint', async () => {
            mock.onPost('/api/calm/namespaces/finos/documents/sad').reply(201, null, {
                location: '/api/calm/namespaces/finos/documents/sad/42/versions/1.0.0',
            });
            await expect(client.createNarrativeDocument('finos', 'sad', request)).resolves.toContain('/42/versions/1.0.0');
            expect(mock.history.post[0].data).toBe(JSON.stringify(request));
        });

        it('returns undefined after a confirmed create response without Location', async () => {
            mock.onPost('/api/calm/namespaces/finos/documents/sad').reply(201, null, {});
            await expect(client.createNarrativeDocument('finos', 'sad', request)).resolves.toBeUndefined();
        });

        it('still rejects a genuine narrative create failure', async () => {
            const endpoint = '/api/calm/namespaces/finos/documents/sad';
            mock.onPost(endpoint).reply(500, { error: 'unavailable' });

            await expect(client.createNarrativeDocument('finos', 'sad', request)).rejects.toMatchObject({
                status: 500,
                request: `POST ${endpoint}`,
            });
        });

        it('creates a typed later version at the version endpoint', async () => {
            const endpoint = '/api/calm/namespaces/finos/documents/knowledge/42/versions/1.1.0';
            mock.onPost(endpoint).reply(201, null, { location: endpoint });

            await expect(client.createNarrativeDocumentVersion('finos', 'knowledge', 42, '1.1.0', request)).resolves.toBe(endpoint);
            expect(mock.history.post[0].data).toBe(JSON.stringify(request));
        });

        it('reads typed Markdown and rejects malformed success bodies', async () => {
            const endpoint = '/api/calm/namespaces/finos/documents/sad/42/versions/1.0.0';
            mock.onGet(endpoint).replyOnce(200, { documentMarkdown: '# Payments' });
            await expect(client.getNarrativeDocumentVersion('finos', 'sad', 42, '1.0.0')).resolves.toEqual({ documentMarkdown: '# Payments' });
            mock.onGet(endpoint).replyOnce(200, {});
            await expect(client.getNarrativeDocumentVersion('finos', 'sad', 42, '1.0.0')).rejects.toBeInstanceOf(HubClientError);
        });

        it('requires a string version array', async () => {
            const endpoint = '/api/calm/namespaces/finos/documents/sad/42/versions';
            mock.onGet(endpoint).replyOnce(200, { values: ['1.0.0'] });
            await expect(client.getNarrativeDocumentVersions('finos', 'sad', 42)).resolves.toEqual(['1.0.0']);
            mock.onGet(endpoint).replyOnce(200, { values: [42] });
            await expect(client.getNarrativeDocumentVersions('finos', 'sad', 42)).rejects.toBeInstanceOf(HubClientError);
        });

        it.each([404, 500])('wraps a %i response from a narrative endpoint', async (status) => {
            const endpoint = '/api/calm/namespaces/finos/documents/sad/42/versions';
            mock.onGet(endpoint).replyOnce(status, { error: 'unavailable' });

            await expect(client.getNarrativeDocumentVersions('finos', 'sad', 42)).rejects.toMatchObject({
                status,
                request: `GET ${endpoint}`,
            });
        });
    });

    describe('configs', () => {
        const base = '/api/calm/namespaces/org.team/configs/c4-mapping';
        const request = { name: 'acme', description: 'Acme mapping', configJson: '{"unique-id":"acme"}' };

        it('lists the configs of a type in a namespace', async () => {
            const summary = { id: 3, name: 'acme', description: 'Acme mapping', versionCount: 2 };
            mock.onGet(base).reply(200, { values: [summary] });
            await expect(client.listConfigs('org.team', 'c4-mapping')).resolves.toEqual([summary]);
        });

        it('creates a config and a later version, and returns each Location', async () => {
            mock.onPost(base).reply(201, null, { location: `${base}/3/versions/1.0.0` });
            mock.onPost(`${base}/3/versions/1.1.0`).reply(201, null, { location: `${base}/3/versions/1.1.0` });

            await expect(client.createConfig('org.team', 'c4-mapping', request)).resolves.toBe(`${base}/3/versions/1.0.0`);
            await expect(client.createConfigVersion('org.team', 'c4-mapping', 3, '1.1.0', request)).resolves.toBe(`${base}/3/versions/1.1.0`);
            expect(mock.history.post.map(p => JSON.parse(p.data))).toEqual([request, request]);
        });

        it('rejects a create response without Location', async () => {
            mock.onPost(base).reply(201, null, {});
            await expect(client.createConfig('org.team', 'c4-mapping', request)).rejects.toBeInstanceOf(HubClientError);
        });

        it('adds the field errors to the message of a rejected config', async () => {
            mock.onPost(`${base}/3/versions/1.1.0`).reply(400, {
                error: 'Config does not match the schema of its type',
                errors: [{ location: '/nesting', error: 'Instance does not match any of the enum values' }, { location: '', error: 'Property unique-id is required' }],
            });
            await expect(client.createConfigVersion('org.team', 'c4-mapping', 3, '1.1.0', request)).rejects.toMatchObject({
                status: 400,
                error: 'Config does not match the schema of its type: /nesting: Instance does not match any of the enum values; /: Property unique-id is required',
                request: `POST ${base}/3/versions/1.1.0`,
            });
        });

        it('keeps the Hub error of a create that fails for another reason', async () => {
            mock.onPost(base).reply(404, { error: 'Invalid namespace provided: org.team' });
            await expect(client.createConfig('org.team', 'c4-mapping', request)).rejects.toMatchObject({
                status: 404,
                error: 'Invalid namespace provided: org.team',
            });
        });

        it('reads the versions and one version of a config', async () => {
            mock.onGet(`${base}/3/versions`).reply(200, { values: ['1.0.0', '1.1.0'] });
            mock.onGet(`${base}/3/versions/1.1.0`).reply(200, { 'unique-id': 'acme' });

            await expect(client.getConfigVersions('org.team', 'c4-mapping', 3)).resolves.toEqual(['1.0.0', '1.1.0']);
            await expect(client.getConfigVersion('org.team', 'c4-mapping', 3, '1.1.0')).resolves.toEqual({ 'unique-id': 'acme' });
        });

        it('rejects a config version body that is not an object', async () => {
            mock.onGet(`${base}/3/versions/1.0.0`).reply(200, '<html>login</html>');
            await expect(client.getConfigVersion('org.team', 'c4-mapping', 3, '1.0.0')).rejects.toBeInstanceOf(HubClientError);
        });

        it('returns the inherited namespace default', async () => {
            const resolved = { configType: 'c4-mapping', namespace: 'org', configId: 1, version: '1.0.0', inherited: true, config: { 'unique-id': 'org' } };
            mock.onGet(`${base}/default`).reply(200, resolved);
            await expect(client.getNamespaceDefaultConfig('org.team', 'c4-mapping')).resolves.toEqual(resolved);
        });

        it('returns undefined when no namespace default applies, but throws on other failures', async () => {
            mock.onGet(`${base}/default`).replyOnce(404, { error: 'No default' });
            await expect(client.getNamespaceDefaultConfig('org.team', 'c4-mapping')).resolves.toBeUndefined();

            mock.onGet(`${base}/default`).replyOnce(500, { error: 'unavailable' });
            await expect(client.getNamespaceDefaultConfig('org.team', 'c4-mapping')).rejects.toMatchObject({ status: 500 });

            mock.onGet(`${base}/default`).replyOnce(200, { configId: 1 });
            await expect(client.getNamespaceDefaultConfig('org.team', 'c4-mapping')).rejects.toBeInstanceOf(HubClientError);
        });

        it('sets the namespace default with the config id and version', async () => {
            mock.onPut(`${base}/default`).reply(200, {});
            await client.setNamespaceDefaultConfig('org.team', 'c4-mapping', 3, '1.1.0');
            expect(JSON.parse(mock.history.put[0].data)).toEqual({ configId: 3, version: '1.1.0' });
        });

        it('throws when setting the default is forbidden', async () => {
            mock.onPut(`${base}/default`).reply(403, { error: 'Forbidden' });
            await expect(client.setNamespaceDefaultConfig('org.team', 'c4-mapping', 3, '1.1.0')).rejects.toMatchObject({
                status: 403,
                request: `PUT ${base}/default`,
            });
        });
    });

    // ── personal namespace ───────────────────────────────────────────────────

    describe('getPersonalNamespace', () => {
        it('returns the personal namespace', async () => {
            mock.onGet('/api/calm/me/namespace').reply(200, { name: 'users.alice', exists: true, owned: false });

            await expect(client.getPersonalNamespace()).resolves.toEqual({ name: 'users.alice', exists: true, owned: false });
        });

        it('throws HubClientError(404) when the feature is off', async () => {
            mock.onGet('/api/calm/me/namespace').reply(404, { error: 'Personal namespaces are not enabled' });

            await expect(client.getPersonalNamespace()).rejects.toMatchObject({
                status: 404,
                error: 'Personal namespaces are not enabled',
                request: 'GET /api/calm/me/namespace'
            });
        });
    });

    describe('createPersonalNamespace', () => {
        it('reports a create on 201', async () => {
            mock.onPut('/api/calm/me/namespace').reply(201, { name: 'users.alice', exists: true, owned: true }, {
                location: 'http://localhost:8080/api/calm/namespaces/users.alice'
            });

            await expect(client.createPersonalNamespace()).resolves.toEqual({
                name: 'users.alice',
                created: true,
                location: 'http://localhost:8080/api/calm/namespaces/users.alice'
            });
        });

        it('reports an existing namespace on 200, with a constructed location', async () => {
            mock.onPut('/api/calm/me/namespace').reply(200, { name: 'users.alice', exists: true, owned: true });

            await expect(client.createPersonalNamespace()).resolves.toEqual({
                name: 'users.alice',
                created: false,
                location: '/api/calm/namespaces/users.alice'
            });
        });

        it('throws HubClientError(409) when another user holds the name', async () => {
            mock.onPut('/api/calm/me/namespace').reply(409, { error: 'Your personal namespace is held by another user' });

            await expect(client.createPersonalNamespace()).rejects.toMatchObject({
                status: 409,
                request: 'PUT /api/calm/me/namespace'
            });
        });
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

        it('throws HubClientError instead of returning [] when the 200 body is not an object (e.g. an auth gateway login page)', async () => {
            mock.onGet('/api/calm/namespaces').reply(200, '<html>please log in</html>');

            await expect(client.listNamespaces()).rejects.toBeInstanceOf(HubClientError);
            await expect(client.listNamespaces()).rejects.toMatchObject({
                request: 'GET /api/calm/namespaces'
            });
        });

        it('throws HubClientError instead of returning [] when the 200 body is a literal null', async () => {
            mock.onGet('/api/calm/namespaces').reply(200, null);

            await expect(client.listNamespaces()).rejects.toBeInstanceOf(HubClientError);
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

        it('injects auth headers on narrative document requests', async () => {
            authMock.onPost('/api/calm/namespaces/finos/documents/sad').reply(201, null, {
                location: '/api/calm/namespaces/finos/documents/sad/42/versions/1.0.0',
            });

            await authClient.createNarrativeDocument('finos', 'sad', {
                name: 'Payments SAD', documentMarkdown: '# Payments',
            });

            expect(getAuthHeaders).toHaveBeenCalledOnce();
            expect(authMock.history.post[0].headers?.Authorization).toBe('Bearer test-token');
        });

        it('injects auth headers when listing narrative document versions', async () => {
            authMock.onGet('/api/calm/namespaces/finos/documents/sad/42/versions').reply(200, { values: [] });

            await authClient.getNarrativeDocumentVersions('finos', 'sad', 42);

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

        it('rejects (rather than resolving with []) when the auth plugin fails to produce credentials', async () => {
            getAuthHeaders.mockRejectedValue(new Error('failed to refresh token'));
            // No mock registered for the endpoint: if the failure were swallowed and the request
            // went out anyway, axios-mock-adapter would 404 rather than the assertion catching it -
            // asserting on the rejection itself is what proves the plugin failure surfaces.
            await expect(authClient.listNamespaces()).rejects.toThrow('failed to refresh token');
        });

        it('surfaces a real 401 from the Hub as an error, not an empty result', async () => {
            authMock.onGet('/api/calm/namespaces').reply(401, { error: 'Unauthorized' });

            await expect(authClient.listNamespaces()).rejects.toMatchObject({
                status: 401,
                error: 'Unauthorized'
            });
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
        it('returns array of domain summaries built from the plain-string API response', async () => {
            mock.onGet('/calm/domains').reply(200, {
                values: ['risk', 'compliance']
            });

            const result = await client.listDomains();
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('risk');
            expect(result[1].name).toBe('compliance');
        });

        it('returns empty array when values is absent', async () => {
            mock.onGet('/calm/domains').reply(200, {});
            const result = await client.listDomains();
            expect(result).toEqual([]);
        });

        it('throws HubClientError instead of returning [] when the 200 body is not an object', async () => {
            mock.onGet('/calm/domains').reply(200, '<html>please log in</html>');
            await expect(client.listDomains()).rejects.toBeInstanceOf(HubClientError);
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

        it('throws HubClientError instead of returning [] when the 200 body is not an object', async () => {
            mock.onGet('/calm/domains/security/controls').reply(200, '<html>please log in</html>');
            await expect(client.listControls('security')).rejects.toBeInstanceOf(HubClientError);
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

        it('throws HubClientError instead of returning [] when the 200 body is not an object', async () => {
            mock.onGet('/calm/domains/security/controls/access-control/configurations').reply(200, '<html>please log in</html>');
            await expect(client.listControlConfigurations('security', 'access-control')).rejects.toBeInstanceOf(HubClientError);
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

        it('returns [] on a genuine 404 (requirement does not exist)', async () => {
            mock.onGet(endpoint).reply(404, 'Not found');
            expect(await client.getControlRequirementVersions('security', 'access-control')).toEqual([]);
        });

        it('throws HubClientError instead of returning [] when a 200 body is not an object', async () => {
            mock.onGet(endpoint).reply(200, '<html>please log in</html>');
            await expect(client.getControlRequirementVersions('security', 'access-control')).rejects.toBeInstanceOf(HubClientError);
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

        it('returns [] on a genuine 404 (configuration does not exist)', async () => {
            mock.onGet(endpoint).reply(404, 'Not found');
            expect(await client.getControlConfigurationVersions('security', 'access-control', 'prod')).toEqual([]);
        });

        it('throws HubClientError instead of returning [] when a 200 body is not an object', async () => {
            mock.onGet(endpoint).reply(200, '<html>please log in</html>');
            await expect(client.getControlConfigurationVersions('security', 'access-control', 'prod')).rejects.toBeInstanceOf(HubClientError);
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
        it('returns the customId strings extracted from ResourceMapping objects', async () => {
            mock.onGet('/calm/namespaces/finos/architectures').reply(200, {
                values: [
                    { customId: 'my-arch', namespace: 'finos', numericId: 1, resourceType: 'ARCHITECTURE' },
                    { customId: 'another-arch', namespace: 'finos', numericId: 2, resourceType: 'ARCHITECTURE' },
                ]
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
            mock.onGet('/calm/namespaces/finos/timelines').reply(200, {
                values: [{ customId: 'api-gateway-timeline', namespace: 'finos', numericId: 3, resourceType: 'TIMELINE' }]
            });

            await client.getNamespaceMappings('finos', 'standards');
            expect(mock.history.get[0].url).toBe('/calm/namespaces/finos/standards');

            const timelines = await client.getNamespaceMappings('finos', 'timelines');
            expect(mock.history.get[1].url).toBe('/calm/namespaces/finos/timelines');
            expect(timelines).toEqual(['api-gateway-timeline']);
        });

        it('throws HubClientError on 500', async () => {
            mock.onGet('/calm/namespaces/finos/architectures').reply(500, 'System Malfunction');

            await expect(client.getNamespaceMappings('finos', 'architectures')).rejects.toMatchObject({
                status: 500,
                request: 'GET /calm/namespaces/finos/architectures'
            });
        });

        it('throws HubClientError instead of returning [] when the 200 body is not an object', async () => {
            mock.onGet('/calm/namespaces/finos/architectures').reply(200, '<html>please log in</html>');
            await expect(client.getNamespaceMappings('finos', 'architectures')).rejects.toBeInstanceOf(HubClientError);
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

        it('posts a timeline document to the timelines endpoint', async () => {
            const timelineId = 'http://localhost:8080/calm/namespaces/finos/timelines/my-timeline/versions/1.0.0';
            const timelineEndpoint = '/calm/namespaces/finos/timelines/my-timeline/versions/1.0.0';
            const timelineMetadata: DocumentMetadata = {
                rawDocumentId: timelineId,
                baseUrl: 'http://localhost:8080',
                namespace: 'finos',
                mapping: 'my-timeline',
                type: 'timelines',
                version: '1.0.0',
                name: 'My Timeline',
                description: 'Timeline evolution'
            };
            const timelineJson = JSON.stringify({
                $id: timelineId,
                title: 'My Timeline',
                description: 'Timeline evolution',
                moments: []
            });
            mock.onPost(timelineEndpoint).reply(201, null, { location: timelineId });

            const result = await client.createMappedResourceVersion(timelineMetadata, timelineJson);
            expect(result).toBe(timelineId);
            expect(mock.history.post[0].url).toBe(timelineEndpoint);
            expect(mock.history.post[0].data).toBe(timelineJson);
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

        it('returns versions for a timeline resource', async () => {
            mock.onGet('/calm/namespaces/finos/timelines/my-timeline/versions').reply(200, {
                values: ['1.0.0', '1.1.0']
            });

            const result = await client.getMappedResourceVersions('finos', 'my-timeline', 'timelines');
            expect(result).toEqual(['1.0.0', '1.1.0']);
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

        it('returns [] on a genuine 404 (mapping does not exist)', async () => {
            mock.onGet('/calm/namespaces/finos/architectures/my-arch/versions').reply(404, 'Not found');
            expect(await client.getMappedResourceVersions('finos', 'my-arch', 'architectures')).toEqual([]);
        });

        it('throws HubClientError instead of returning [] when a 200 body is not an object', async () => {
            mock.onGet('/calm/namespaces/finos/architectures/my-arch/versions').reply(200, '<html>please log in</html>');
            await expect(client.getMappedResourceVersions('finos', 'my-arch', 'architectures')).rejects.toBeInstanceOf(HubClientError);
        });
    });

    // ── getMappedResourceLatestVersion ────────────────────────────────────────

    describe('getMappedResourceLatestVersion', () => {
        it('returns the document for the last version that CALM Hub lists', async () => {
            mock.onGet('/calm/namespaces/finos/architectures/my-arch/versions').reply(200, {
                values: ['1.0.0', '1.1.0', '2.0.0']
            });
            mock.onGet('/calm/namespaces/finos/architectures/my-arch/versions/2.0.0').reply(200, { nodes: [] });

            const result = await client.getMappedResourceLatestVersion('finos', 'my-arch', 'architectures');
            expect(result).toEqual({ nodes: [] });
        });

        it('returns the newest commit when CALM Hub lists commit SHAs (GitHub storage mode)', async () => {
            mock.onGet('/calm/namespaces/finos/architectures/my-arch/versions').reply(200, {
                values: ['a1b2c3d', 'e4f5a6b']
            });
            mock.onGet('/calm/namespaces/finos/architectures/my-arch/versions/e4f5a6b').reply(200, { nodes: [] });

            const result = await client.getMappedResourceLatestVersion('finos', 'my-arch', 'architectures');
            expect(result).toEqual({ nodes: [] });
        });

        it('throws HubClientError(404) when the mapping does not exist', async () => {
            mock.onGet('/calm/namespaces/finos/architectures/missing/versions').reply(404, 'Not found');

            await expect(client.getMappedResourceLatestVersion('finos', 'missing', 'architectures')).rejects.toMatchObject({
                status: 404,
                request: 'GET /calm/namespaces/finos/architectures/missing/versions'
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

        it('returns a timeline document for the requested version', async () => {
            mock.onGet('/calm/namespaces/finos/timelines/my-timeline/versions/1.0.0').reply(200, { moments: [] });

            const result = await client.getMappedResourceByVersion('finos', 'my-timeline', '1.0.0', 'timelines');
            expect(result).toEqual({ moments: [] });
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
