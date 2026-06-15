import { AuthPlugin } from '../auth/auth-plugin';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { CalmHubClient, HubClientError } from './calm-hub-client';

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

    // ── pushArchitecture ─────────────────────────────────────────────────────

    describe('pushArchitecture', () => {
        const archJson = JSON.stringify({ nodes: [] });

        it('returns id, version and location on 201', async () => {
            mock.onPost('/api/calm/namespaces/finos/architectures').reply(201, null, {
                location: '/api/calm/namespaces/finos/architectures/42/versions/1.0.0'
            });

            const result = await client.pushArchitecture('finos', 'my-arch', 'A desc', archJson);
            expect(result).toEqual({ id: 42, version: '1.0.0', location: '/api/calm/namespaces/finos/architectures/42/versions/1.0.0' });
        });

        it('throws HubClientError(400) on invalid JSON body', async () => {
            mock.onPost('/api/calm/namespaces/finos/architectures').reply(400, 'The architecture JSON could not be parsed');

            await expect(client.pushArchitecture('finos', 'my-arch', '', archJson)).rejects.toMatchObject({
                status: 400,
                request: 'POST /api/calm/namespaces/finos/architectures'
            });
        });

        it('throws HubClientError when location header is unparseable', async () => {
            mock.onPost('/api/calm/namespaces/finos/architectures').reply(201, null, {
                location: '/api/calm/namespaces/finos/architectures/bad'
            });

            await expect(client.pushArchitecture('finos', 'my-arch', '', archJson)).rejects.toMatchObject({
                status: 0
            });
        });
    });

    // ── pushArchitectureVersion ──────────────────────────────────────────────

    describe('pushArchitectureVersion', () => {
        const archJson = JSON.stringify({ nodes: [] });

        it('returns id, version and location on 201', async () => {
            mock.onPost('/api/calm/namespaces/finos/architectures/42/versions/2.0.0').reply(201, null, {
                location: '/api/calm/namespaces/finos/architectures/42/versions/2.0.0'
            });

            const result = await client.pushArchitectureVersion('finos', 42, '2.0.0', 'my-arch', '', archJson);
            expect(result).toEqual({ id: 42, version: '2.0.0', location: '/api/calm/namespaces/finos/architectures/42/versions/2.0.0' });
        });

        it('throws HubClientError(409) on duplicate version', async () => {
            mock.onPost('/api/calm/namespaces/finos/architectures/42/versions/1.0.0').reply(409, 'Version already exists: 1.0.0');

            await expect(client.pushArchitectureVersion('finos', 42, '1.0.0', 'my-arch', '', archJson)).rejects.toMatchObject({
                status: 409
            });
        });

        it('throws HubClientError(404) when architecture id not found', async () => {
            mock.onPost('/api/calm/namespaces/finos/architectures/99/versions/1.0.0').reply(404, 'Invalid architecture provided: 99');

            await expect(client.pushArchitectureVersion('finos', 99, '1.0.0', 'my-arch', '', archJson)).rejects.toMatchObject({
                status: 404
            });
        });
    });

    // ── listArchitectures ────────────────────────────────────────────────────

    describe('listArchitectures', () => {
        it('fetches versions per architecture and returns summaries', async () => {
            mock.onGet('/api/calm/namespaces/finos/architectures').reply(200, {
                values: [
                    { id: 1, name: 'arch-a', description: '' },
                    { id: 2, name: 'arch-b', description: '' }
                ]
            });
            mock.onGet('/api/calm/namespaces/finos/architectures/1/versions').reply(200, { values: ['1.0.0', '1.1.0'] });
            mock.onGet('/api/calm/namespaces/finos/architectures/2/versions').reply(200, { values: ['1.0.0'] });

            const result = await client.listArchitectures('finos');
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: 1, name: 'arch-a', description: '', versions: ['1.0.0', '1.1.0'] });
            expect(result[1]).toEqual({ id: 2, name: 'arch-b', description: '', versions: ['1.0.0'] });
        });

        it('returns empty array when no architectures exist', async () => {
            mock.onGet('/api/calm/namespaces/finos/architectures').reply(200, { values: [] });
            const result = await client.listArchitectures('finos');
            expect(result).toEqual([]);
        });

        it('throws HubClientError(404) for unknown namespace', async () => {
            mock.onGet('/api/calm/namespaces/unknown/architectures').reply(404, 'Namespace not found');
            await expect(client.listArchitectures('unknown')).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── pullArchitecture ─────────────────────────────────────────────────────

    describe('pullArchitecture', () => {
        it('returns the architecture detail object', async () => {
            const detail = {
                namespace: 'finos',
                id: 1,
                name: 'arch-a',
                description: '',
                version: '1.0.0',
                architecture: '{"nodes":[]}'
            };
            mock.onGet('/api/calm/namespaces/finos/architectures/1/versions/1.0.0').reply(200, detail);

            const result = await client.pullArchitecture('finos', 1, '1.0.0');
            expect(result).toEqual(detail);
        });

        it('throws HubClientError(404) when not found', async () => {
            mock.onGet('/api/calm/namespaces/finos/architectures/99/versions/1.0.0').reply(404, 'Invalid architecture provided: 99');
            await expect(client.pullArchitecture('finos', 99, '1.0.0')).rejects.toMatchObject({ status: 404 });
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

        it('injects auth headers on pushArchitecture', async () => {
            authMock.onPost('/api/calm/namespaces/finos/architectures').reply(201, null, {
                location: '/api/calm/namespaces/finos/architectures/1/versions/1.0.0'
            });

            await authClient.pushArchitecture('finos', 'arch', 'desc', '{}');

            expect(getAuthHeaders).toHaveBeenCalledOnce();
            expect(authMock.history.post[0].headers?.Authorization).toBe('Bearer test-token');
        });

        it('injects auth headers on pushArchitectureVersion', async () => {
            authMock.onPost('/api/calm/namespaces/finos/architectures/1/versions/2.0.0').reply(201, null, {
                location: '/api/calm/namespaces/finos/architectures/1/versions/2.0.0'
            });

            await authClient.pushArchitectureVersion('finos', 1, '2.0.0', 'arch', 'desc', '{}');

            expect(getAuthHeaders).toHaveBeenCalledOnce();
            expect(authMock.history.post[0].headers?.Authorization).toBe('Bearer test-token');
        });

        it('injects auth headers on listArchitectures (including version sub-requests)', async () => {
            authMock.onGet('/api/calm/namespaces/finos/architectures').reply(200, {
                values: [{ id: 1, name: 'arch-a', description: '' }]
            });
            authMock.onGet('/api/calm/namespaces/finos/architectures/1/versions').reply(200, { values: ['1.0.0'] });

            await authClient.listArchitectures('finos');

            expect(getAuthHeaders).toHaveBeenCalledTimes(2);
            expect(authMock.history.get[0].headers?.Authorization).toBe('Bearer test-token');
            expect(authMock.history.get[1].headers?.Authorization).toBe('Bearer test-token');
        });

        it('injects auth headers on pullArchitecture', async () => {
            authMock.onGet('/api/calm/namespaces/finos/architectures/1/versions/1.0.0').reply(200, { nodes: [] });

            await authClient.pullArchitecture('finos', 1, '1.0.0');

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

    // ── pushPattern ──────────────────────────────────────────────────────────

    describe('pushPattern', () => {
        const patternJson = JSON.stringify({ nodes: [] });

        it('returns id, version and location on 201', async () => {
            mock.onPost('/api/calm/namespaces/finos/patterns').reply(201, null, {
                location: '/api/calm/namespaces/finos/patterns/10/versions/1.0.0'
            });

            const result = await client.pushPattern('finos', 'my-pattern', 'A desc', patternJson);
            expect(result).toEqual({ id: 10, version: '1.0.0', location: '/api/calm/namespaces/finos/patterns/10/versions/1.0.0' });
        });

        it('sends correct body fields', async () => {
            let capturedBody: unknown;
            mock.onPost('/api/calm/namespaces/finos/patterns').reply((config) => {
                capturedBody = JSON.parse(config.data as string);
                return [201, null, { location: '/api/calm/namespaces/finos/patterns/1/versions/1.0.0' }];
            });

            await client.pushPattern('finos', 'my-pattern', 'desc', patternJson);
            expect(capturedBody).toMatchObject({ name: 'my-pattern', description: 'desc', patternJson });
        });

        it('throws HubClientError(400) on bad request', async () => {
            mock.onPost('/api/calm/namespaces/finos/patterns').reply(400, 'Bad request');
            await expect(client.pushPattern('finos', 'bad', '', patternJson)).rejects.toMatchObject({
                status: 400,
                request: 'POST /api/calm/namespaces/finos/patterns'
            });
        });

        it('throws HubClientError when location header is unparseable', async () => {
            mock.onPost('/api/calm/namespaces/finos/patterns').reply(201, null, { location: '/bad' });
            await expect(client.pushPattern('finos', 'x', '', patternJson)).rejects.toMatchObject({ status: 0 });
        });
    });

    // ── pushPatternVersion ───────────────────────────────────────────────────

    describe('pushPatternVersion', () => {
        const patternJson = JSON.stringify({ nodes: [] });

        it('returns id, version and location on 201', async () => {
            mock.onPost('/api/calm/namespaces/finos/patterns/10/versions/2.0.0').reply(201, null, {
                location: '/api/calm/namespaces/finos/patterns/10/versions/2.0.0'
            });

            const result = await client.pushPatternVersion('finos', 10, '2.0.0', 'my-pattern', '', patternJson);
            expect(result).toEqual({ id: 10, version: '2.0.0', location: '/api/calm/namespaces/finos/patterns/10/versions/2.0.0' });
        });

        it('sends pattern metadata and patternJson in the request body', async () => {
            let capturedBody: unknown;
            mock.onPost('/api/calm/namespaces/finos/patterns/10/versions/2.0.0').reply((config) => {
                capturedBody = JSON.parse(config.data as string);
                return [201, null, { location: '/api/calm/namespaces/finos/patterns/10/versions/2.0.0' }];
            });

            await client.pushPatternVersion('finos', 10, '2.0.0', 'my-pattern', 'desc', patternJson);

            expect(capturedBody).toEqual({
                name: 'my-pattern',
                description: 'desc',
                patternJson
            });
        });

        it('throws HubClientError(409) on duplicate version', async () => {
            mock.onPost('/api/calm/namespaces/finos/patterns/10/versions/1.0.0').reply(409, 'Version already exists');
            await expect(client.pushPatternVersion('finos', 10, '1.0.0', 'p', '', patternJson)).rejects.toMatchObject({ status: 409 });
        });

        it('throws HubClientError(404) when pattern id not found', async () => {
            mock.onPost('/api/calm/namespaces/finos/patterns/99/versions/1.0.0').reply(404, 'Pattern not found');
            await expect(client.pushPatternVersion('finos', 99, '1.0.0', 'p', '', patternJson)).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── listPatterns ─────────────────────────────────────────────────────────

    describe('listPatterns', () => {
        it('fetches versions per pattern and returns summaries', async () => {
            mock.onGet('/api/calm/namespaces/finos/patterns').reply(200, {
                values: [
                    { id: 1, name: 'pattern-a', description: 'desc-a' },
                    { id: 2, name: 'pattern-b', description: '' }
                ]
            });
            mock.onGet('/api/calm/namespaces/finos/patterns/1/versions').reply(200, { values: ['1.0.0'] });
            mock.onGet('/api/calm/namespaces/finos/patterns/2/versions').reply(200, { values: ['1.0.0', '2.0.0'] });

            const result = await client.listPatterns('finos');
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: 1, name: 'pattern-a', description: 'desc-a', versions: ['1.0.0'] });
            expect(result[1]).toEqual({ id: 2, name: 'pattern-b', description: '', versions: ['1.0.0', '2.0.0'] });
        });

        it('returns empty array when no patterns exist', async () => {
            mock.onGet('/api/calm/namespaces/finos/patterns').reply(200, { values: [] });
            const result = await client.listPatterns('finos');
            expect(result).toEqual([]);
        });

        it('throws HubClientError(404) for unknown namespace', async () => {
            mock.onGet('/api/calm/namespaces/unknown/patterns').reply(404, 'Namespace not found');
            await expect(client.listPatterns('unknown')).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── pullPattern ──────────────────────────────────────────────────────────

    describe('pullPattern', () => {
        it('returns the pattern detail object', async () => {
            const detail = { id: 1, name: 'pattern-a', version: '1.0.0', patternJson: '{}' };
            mock.onGet('/api/calm/namespaces/finos/patterns/1/versions/1.0.0').reply(200, detail);

            const result = await client.pullPattern('finos', 1, '1.0.0');
            expect(result).toEqual(detail);
        });

        it('throws HubClientError(404) when not found', async () => {
            mock.onGet('/api/calm/namespaces/finos/patterns/99/versions/1.0.0').reply(404, 'Pattern not found');
            await expect(client.pullPattern('finos', 99, '1.0.0')).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── pushStandard ─────────────────────────────────────────────────────────

    describe('pushStandard', () => {
        const standardJson = 'raw standard content';

        it('returns id, version and location on 201', async () => {
            mock.onPost('/api/calm/namespaces/finos/standards').reply(201, null, {
                location: '/api/calm/namespaces/finos/standards/20/versions/1.0.0'
            });

            const result = await client.pushStandard('finos', 'my-standard', 'A desc', standardJson);
            expect(result).toEqual({ id: 20, version: '1.0.0', location: '/api/calm/namespaces/finos/standards/20/versions/1.0.0' });
        });

        it('sends standardJson as a string field in the body', async () => {
            let capturedBody: unknown;
            mock.onPost('/api/calm/namespaces/finos/standards').reply((config) => {
                capturedBody = JSON.parse(config.data as string);
                return [201, null, { location: '/api/calm/namespaces/finos/standards/1/versions/1.0.0' }];
            });

            await client.pushStandard('finos', 'my-standard', 'desc', standardJson);
            expect(capturedBody).toMatchObject({ name: 'my-standard', description: 'desc', standardJson });
        });

        it('throws HubClientError(400) on bad request', async () => {
            mock.onPost('/api/calm/namespaces/finos/standards').reply(400, 'Bad request');
            await expect(client.pushStandard('finos', 'bad', '', standardJson)).rejects.toMatchObject({
                status: 400,
                request: 'POST /api/calm/namespaces/finos/standards'
            });
        });

        it('throws HubClientError when location header is unparseable', async () => {
            mock.onPost('/api/calm/namespaces/finos/standards').reply(201, null, { location: '/bad' });
            await expect(client.pushStandard('finos', 'x', '', standardJson)).rejects.toMatchObject({ status: 0 });
        });
    });

    // ── pushStandardVersion ──────────────────────────────────────────────────

    describe('pushStandardVersion', () => {
        const standardJson = 'raw standard content';

        it('returns id, version and location on 201', async () => {
            mock.onPost('/api/calm/namespaces/finos/standards/20/versions/2.0.0').reply(201, null, {
                location: '/api/calm/namespaces/finos/standards/20/versions/2.0.0'
            });

            const result = await client.pushStandardVersion('finos', 20, '2.0.0', 'my-standard', '', standardJson);
            expect(result).toEqual({ id: 20, version: '2.0.0', location: '/api/calm/namespaces/finos/standards/20/versions/2.0.0' });
        });

        it('throws HubClientError(409) on duplicate version', async () => {
            mock.onPost('/api/calm/namespaces/finos/standards/20/versions/1.0.0').reply(409, 'Version already exists');
            await expect(client.pushStandardVersion('finos', 20, '1.0.0', 's', '', standardJson)).rejects.toMatchObject({ status: 409 });
        });

        it('throws HubClientError(404) when standard id not found', async () => {
            mock.onPost('/api/calm/namespaces/finos/standards/99/versions/1.0.0').reply(404, 'Standard not found');
            await expect(client.pushStandardVersion('finos', 99, '1.0.0', 's', '', standardJson)).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── listStandards ────────────────────────────────────────────────────────

    describe('listStandards', () => {
        it('fetches versions per standard and returns summaries', async () => {
            mock.onGet('/api/calm/namespaces/finos/standards').reply(200, {
                values: [
                    { id: 1, name: 'standard-a', description: 'desc-a' },
                    { id: 2, name: 'standard-b', description: '' }
                ]
            });
            mock.onGet('/api/calm/namespaces/finos/standards/1/versions').reply(200, { values: ['1.0.0'] });
            mock.onGet('/api/calm/namespaces/finos/standards/2/versions').reply(200, { values: ['1.0.0', '2.0.0'] });

            const result = await client.listStandards('finos');
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: 1, name: 'standard-a', description: 'desc-a', versions: ['1.0.0'] });
            expect(result[1]).toEqual({ id: 2, name: 'standard-b', description: '', versions: ['1.0.0', '2.0.0'] });
        });

        it('returns empty array when no standards exist', async () => {
            mock.onGet('/api/calm/namespaces/finos/standards').reply(200, { values: [] });
            const result = await client.listStandards('finos');
            expect(result).toEqual([]);
        });

        it('throws HubClientError(404) for unknown namespace', async () => {
            mock.onGet('/api/calm/namespaces/unknown/standards').reply(404, 'Namespace not found');
            await expect(client.listStandards('unknown')).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── pullStandard ─────────────────────────────────────────────────────────

    describe('pullStandard', () => {
        it('returns the standard detail object', async () => {
            const detail = { id: 1, name: 'standard-a', version: '1.0.0', standardJson: 'raw' };
            mock.onGet('/api/calm/namespaces/finos/standards/1/versions/1.0.0').reply(200, detail);

            const result = await client.pullStandard('finos', 1, '1.0.0');
            expect(result).toEqual(detail);
        });

        it('throws HubClientError(404) when not found', async () => {
            mock.onGet('/api/calm/namespaces/finos/standards/99/versions/1.0.0').reply(404, 'Standard not found');
            await expect(client.pullStandard('finos', 99, '1.0.0')).rejects.toMatchObject({ status: 404 });
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
