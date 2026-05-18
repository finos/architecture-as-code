import { describe, it, expect, beforeEach } from 'vitest';
import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { CalmHubClient, HubClientError } from './calm-hub-client';

describe('CalmHubClient', () => {
    let mock: AxiosMockAdapter;
    let client: CalmHubClient;

    beforeEach(() => {
        const ax = axios.create({ baseURL: 'http://localhost:8080' });
        mock = new AxiosMockAdapter(ax);
        client = new CalmHubClient('http://localhost:8080', ax);
    });

    // ── createNamespace ──────────────────────────────────────────────────────

    describe('createNamespace', () => {
        it('returns name and location on 201', async () => {
            mock.onPost('/calm/namespaces').reply(201, null, {
                location: '/calm/namespaces/my-org'
            });

            const result = await client.createNamespace('my-org', 'My organisation');
            expect(result.name).toBe('my-org');
            expect(result.location).toBe('/calm/namespaces/my-org');
        });

        it('falls back to constructed location when header is absent', async () => {
            mock.onPost('/calm/namespaces').reply(201, null, {});

            const result = await client.createNamespace('my-org', 'My organisation');
            expect(result.location).toBe('/calm/namespaces/my-org');
        });

        it('throws HubClientError(409) on conflict', async () => {
            mock.onPost('/calm/namespaces').reply(409, { error: 'Namespace already exists' });

            await expect(client.createNamespace('my-org', 'My organisation')).rejects.toMatchObject({
                status: 409,
                error: 'Namespace already exists',
                request: 'POST /calm/namespaces'
            });
        });

        it('throws HubClientError on network failure', async () => {
            mock.onPost('/calm/namespaces').networkError();

            await expect(client.createNamespace('my-org', 'My organisation')).rejects.toBeInstanceOf(HubClientError);
        });
    });

    // ── listNamespaces ───────────────────────────────────────────────────────

    describe('listNamespaces', () => {
        it('returns array of namespace summaries', async () => {
            mock.onGet('/calm/namespaces').reply(200, {
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
            mock.onGet('/calm/namespaces').reply(200, {});
            const result = await client.listNamespaces();
            expect(result).toEqual([]);
        });

        it('throws HubClientError on 500', async () => {
            mock.onGet('/calm/namespaces').reply(500, 'System Malfunction');

            await expect(client.listNamespaces()).rejects.toMatchObject({
                status: 500,
                request: 'GET /calm/namespaces'
            });
        });
    });

    // ── pushArchitecture ─────────────────────────────────────────────────────

    describe('pushArchitecture', () => {
        const archJson = JSON.stringify({ nodes: [] });

        it('returns id, version and location on 201', async () => {
            mock.onPost('/calm/namespaces/finos/architectures').reply(201, null, {
                location: '/calm/namespaces/finos/architectures/42/versions/1.0.0'
            });

            const result = await client.pushArchitecture('finos', 'my-arch', 'A desc', archJson);
            expect(result).toEqual({ id: 42, version: '1.0.0', location: '/calm/namespaces/finos/architectures/42/versions/1.0.0' });
        });

        it('throws HubClientError(400) on invalid JSON body', async () => {
            mock.onPost('/calm/namespaces/finos/architectures').reply(400, 'The architecture JSON could not be parsed');

            await expect(client.pushArchitecture('finos', 'my-arch', '', archJson)).rejects.toMatchObject({
                status: 400,
                request: 'POST /calm/namespaces/finos/architectures'
            });
        });

        it('throws HubClientError when location header is unparseable', async () => {
            mock.onPost('/calm/namespaces/finos/architectures').reply(201, null, {
                location: '/calm/namespaces/finos/architectures/bad'
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
            mock.onPost('/calm/namespaces/finos/architectures/42/versions/2.0.0').reply(201, null, {
                location: '/calm/namespaces/finos/architectures/42/versions/2.0.0'
            });

            const result = await client.pushArchitectureVersion('finos', 42, '2.0.0', 'my-arch', '', archJson);
            expect(result).toEqual({ id: 42, version: '2.0.0', location: '/calm/namespaces/finos/architectures/42/versions/2.0.0' });
        });

        it('throws HubClientError(409) on duplicate version', async () => {
            mock.onPost('/calm/namespaces/finos/architectures/42/versions/1.0.0').reply(409, 'Version already exists: 1.0.0');

            await expect(client.pushArchitectureVersion('finos', 42, '1.0.0', 'my-arch', '', archJson)).rejects.toMatchObject({
                status: 409
            });
        });

        it('throws HubClientError(404) when architecture id not found', async () => {
            mock.onPost('/calm/namespaces/finos/architectures/99/versions/1.0.0').reply(404, 'Invalid architecture provided: 99');

            await expect(client.pushArchitectureVersion('finos', 99, '1.0.0', 'my-arch', '', archJson)).rejects.toMatchObject({
                status: 404
            });
        });
    });

    // ── listArchitectures ────────────────────────────────────────────────────

    describe('listArchitectures', () => {
        it('fetches versions per architecture and returns summaries', async () => {
            mock.onGet('/calm/namespaces/finos/architectures').reply(200, {
                values: [
                    { id: 1, name: 'arch-a', description: '' },
                    { id: 2, name: 'arch-b', description: '' }
                ]
            });
            mock.onGet('/calm/namespaces/finos/architectures/1/versions').reply(200, { values: ['1.0.0', '1.1.0'] });
            mock.onGet('/calm/namespaces/finos/architectures/2/versions').reply(200, { values: ['1.0.0'] });

            const result = await client.listArchitectures('finos');
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: 1, name: 'arch-a', description: '', versions: ['1.0.0', '1.1.0'] });
            expect(result[1]).toEqual({ id: 2, name: 'arch-b', description: '', versions: ['1.0.0'] });
        });

        it('returns empty array when no architectures exist', async () => {
            mock.onGet('/calm/namespaces/finos/architectures').reply(200, { values: [] });
            const result = await client.listArchitectures('finos');
            expect(result).toEqual([]);
        });

        it('throws HubClientError(404) for unknown namespace', async () => {
            mock.onGet('/calm/namespaces/unknown/architectures').reply(404, 'Namespace not found');
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
            mock.onGet('/calm/namespaces/finos/architectures/1/versions/1.0.0').reply(200, detail);

            const result = await client.pullArchitecture('finos', 1, '1.0.0');
            expect(result).toEqual(detail);
        });

        it('throws HubClientError(404) when not found', async () => {
            mock.onGet('/calm/namespaces/finos/architectures/99/versions/1.0.0').reply(404, 'Invalid architecture provided: 99');
            await expect(client.pullArchitecture('finos', 99, '1.0.0')).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── pushPattern ──────────────────────────────────────────────────────────

    describe('pushPattern', () => {
        const patternJson = JSON.stringify({ nodes: [] });

        it('returns id, version and location on 201', async () => {
            mock.onPost('/calm/namespaces/finos/patterns').reply(201, null, {
                location: '/calm/namespaces/finos/patterns/10/versions/1.0.0'
            });

            const result = await client.pushPattern('finos', 'my-pattern', 'A desc', patternJson);
            expect(result).toEqual({ id: 10, version: '1.0.0', location: '/calm/namespaces/finos/patterns/10/versions/1.0.0' });
        });

        it('sends correct body fields', async () => {
            let capturedBody: unknown;
            mock.onPost('/calm/namespaces/finos/patterns').reply((config) => {
                capturedBody = JSON.parse(config.data as string);
                return [201, null, { location: '/calm/namespaces/finos/patterns/1/versions/1.0.0' }];
            });

            await client.pushPattern('finos', 'my-pattern', 'desc', patternJson);
            expect(capturedBody).toMatchObject({ name: 'my-pattern', description: 'desc', patternJson });
        });

        it('throws HubClientError(400) on bad request', async () => {
            mock.onPost('/calm/namespaces/finos/patterns').reply(400, 'Bad request');
            await expect(client.pushPattern('finos', 'bad', '', patternJson)).rejects.toMatchObject({
                status: 400,
                request: 'POST /calm/namespaces/finos/patterns'
            });
        });

        it('throws HubClientError when location header is unparseable', async () => {
            mock.onPost('/calm/namespaces/finos/patterns').reply(201, null, { location: '/bad' });
            await expect(client.pushPattern('finos', 'x', '', patternJson)).rejects.toMatchObject({ status: 0 });
        });
    });

    // ── pushPatternVersion ───────────────────────────────────────────────────

    describe('pushPatternVersion', () => {
        const patternJson = JSON.stringify({ nodes: [] });

        it('returns id, version and location on 201', async () => {
            mock.onPost('/calm/namespaces/finos/patterns/10/versions/2.0.0').reply(201, null, {
                location: '/calm/namespaces/finos/patterns/10/versions/2.0.0'
            });

            const result = await client.pushPatternVersion('finos', 10, '2.0.0', 'my-pattern', '', patternJson);
            expect(result).toEqual({ id: 10, version: '2.0.0', location: '/calm/namespaces/finos/patterns/10/versions/2.0.0' });
        });

        it('throws HubClientError(409) on duplicate version', async () => {
            mock.onPost('/calm/namespaces/finos/patterns/10/versions/1.0.0').reply(409, 'Version already exists');
            await expect(client.pushPatternVersion('finos', 10, '1.0.0', 'p', '', patternJson)).rejects.toMatchObject({ status: 409 });
        });

        it('throws HubClientError(404) when pattern id not found', async () => {
            mock.onPost('/calm/namespaces/finos/patterns/99/versions/1.0.0').reply(404, 'Pattern not found');
            await expect(client.pushPatternVersion('finos', 99, '1.0.0', 'p', '', patternJson)).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── listPatterns ─────────────────────────────────────────────────────────

    describe('listPatterns', () => {
        it('fetches versions per pattern and returns summaries', async () => {
            mock.onGet('/calm/namespaces/finos/patterns').reply(200, {
                values: [
                    { id: 1, name: 'pattern-a', description: 'desc-a' },
                    { id: 2, name: 'pattern-b', description: '' }
                ]
            });
            mock.onGet('/calm/namespaces/finos/patterns/1/versions').reply(200, { values: ['1.0.0'] });
            mock.onGet('/calm/namespaces/finos/patterns/2/versions').reply(200, { values: ['1.0.0', '2.0.0'] });

            const result = await client.listPatterns('finos');
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: 1, name: 'pattern-a', description: 'desc-a', versions: ['1.0.0'] });
            expect(result[1]).toEqual({ id: 2, name: 'pattern-b', description: '', versions: ['1.0.0', '2.0.0'] });
        });

        it('returns empty array when no patterns exist', async () => {
            mock.onGet('/calm/namespaces/finos/patterns').reply(200, { values: [] });
            const result = await client.listPatterns('finos');
            expect(result).toEqual([]);
        });

        it('throws HubClientError(404) for unknown namespace', async () => {
            mock.onGet('/calm/namespaces/unknown/patterns').reply(404, 'Namespace not found');
            await expect(client.listPatterns('unknown')).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── pullPattern ──────────────────────────────────────────────────────────

    describe('pullPattern', () => {
        it('returns the pattern detail object', async () => {
            const detail = { id: 1, name: 'pattern-a', version: '1.0.0', patternJson: '{}' };
            mock.onGet('/calm/namespaces/finos/patterns/1/versions/1.0.0').reply(200, detail);

            const result = await client.pullPattern('finos', 1, '1.0.0');
            expect(result).toEqual(detail);
        });

        it('throws HubClientError(404) when not found', async () => {
            mock.onGet('/calm/namespaces/finos/patterns/99/versions/1.0.0').reply(404, 'Pattern not found');
            await expect(client.pullPattern('finos', 99, '1.0.0')).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── pushStandard ─────────────────────────────────────────────────────────

    describe('pushStandard', () => {
        const standardJson = 'raw standard content';

        it('returns id, version and location on 201', async () => {
            mock.onPost('/calm/namespaces/finos/standards').reply(201, null, {
                location: '/calm/namespaces/finos/standards/20/versions/1.0.0'
            });

            const result = await client.pushStandard('finos', 'my-standard', 'A desc', standardJson);
            expect(result).toEqual({ id: 20, version: '1.0.0', location: '/calm/namespaces/finos/standards/20/versions/1.0.0' });
        });

        it('sends standardJson as a string field in the body', async () => {
            let capturedBody: unknown;
            mock.onPost('/calm/namespaces/finos/standards').reply((config) => {
                capturedBody = JSON.parse(config.data as string);
                return [201, null, { location: '/calm/namespaces/finos/standards/1/versions/1.0.0' }];
            });

            await client.pushStandard('finos', 'my-standard', 'desc', standardJson);
            expect(capturedBody).toMatchObject({ name: 'my-standard', description: 'desc', standardJson });
        });

        it('throws HubClientError(400) on bad request', async () => {
            mock.onPost('/calm/namespaces/finos/standards').reply(400, 'Bad request');
            await expect(client.pushStandard('finos', 'bad', '', standardJson)).rejects.toMatchObject({
                status: 400,
                request: 'POST /calm/namespaces/finos/standards'
            });
        });

        it('throws HubClientError when location header is unparseable', async () => {
            mock.onPost('/calm/namespaces/finos/standards').reply(201, null, { location: '/bad' });
            await expect(client.pushStandard('finos', 'x', '', standardJson)).rejects.toMatchObject({ status: 0 });
        });
    });

    // ── pushStandardVersion ──────────────────────────────────────────────────

    describe('pushStandardVersion', () => {
        const standardJson = 'raw standard content';

        it('returns id, version and location on 201', async () => {
            mock.onPost('/calm/namespaces/finos/standards/20/versions/2.0.0').reply(201, null, {
                location: '/calm/namespaces/finos/standards/20/versions/2.0.0'
            });

            const result = await client.pushStandardVersion('finos', 20, '2.0.0', 'my-standard', '', standardJson);
            expect(result).toEqual({ id: 20, version: '2.0.0', location: '/calm/namespaces/finos/standards/20/versions/2.0.0' });
        });

        it('throws HubClientError(409) on duplicate version', async () => {
            mock.onPost('/calm/namespaces/finos/standards/20/versions/1.0.0').reply(409, 'Version already exists');
            await expect(client.pushStandardVersion('finos', 20, '1.0.0', 's', '', standardJson)).rejects.toMatchObject({ status: 409 });
        });

        it('throws HubClientError(404) when standard id not found', async () => {
            mock.onPost('/calm/namespaces/finos/standards/99/versions/1.0.0').reply(404, 'Standard not found');
            await expect(client.pushStandardVersion('finos', 99, '1.0.0', 's', '', standardJson)).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── listStandards ────────────────────────────────────────────────────────

    describe('listStandards', () => {
        it('fetches versions per standard and returns summaries', async () => {
            mock.onGet('/calm/namespaces/finos/standards').reply(200, {
                values: [
                    { id: 1, name: 'standard-a', description: 'desc-a' },
                    { id: 2, name: 'standard-b', description: '' }
                ]
            });
            mock.onGet('/calm/namespaces/finos/standards/1/versions').reply(200, { values: ['1.0.0'] });
            mock.onGet('/calm/namespaces/finos/standards/2/versions').reply(200, { values: ['1.0.0', '2.0.0'] });

            const result = await client.listStandards('finos');
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: 1, name: 'standard-a', description: 'desc-a', versions: ['1.0.0'] });
            expect(result[1]).toEqual({ id: 2, name: 'standard-b', description: '', versions: ['1.0.0', '2.0.0'] });
        });

        it('returns empty array when no standards exist', async () => {
            mock.onGet('/calm/namespaces/finos/standards').reply(200, { values: [] });
            const result = await client.listStandards('finos');
            expect(result).toEqual([]);
        });

        it('throws HubClientError(404) for unknown namespace', async () => {
            mock.onGet('/calm/namespaces/unknown/standards').reply(404, 'Namespace not found');
            await expect(client.listStandards('unknown')).rejects.toMatchObject({ status: 404 });
        });
    });

    // ── pullStandard ─────────────────────────────────────────────────────────

    describe('pullStandard', () => {
        it('returns the standard detail object', async () => {
            const detail = { id: 1, name: 'standard-a', version: '1.0.0', standardJson: 'raw' };
            mock.onGet('/calm/namespaces/finos/standards/1/versions/1.0.0').reply(200, detail);

            const result = await client.pullStandard('finos', 1, '1.0.0');
            expect(result).toEqual(detail);
        });

        it('throws HubClientError(404) when not found', async () => {
            mock.onGet('/calm/namespaces/finos/standards/99/versions/1.0.0').reply(404, 'Standard not found');
            await expect(client.pullStandard('finos', 99, '1.0.0')).rejects.toMatchObject({ status: 404 });
        });
    });
});
