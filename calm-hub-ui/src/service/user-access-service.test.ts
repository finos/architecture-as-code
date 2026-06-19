import { describe, it, expect, afterEach } from 'vitest';
import AxiosMockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { UserAccessService } from './user-access-service.js';
import { UserAccess, UserAccessRequest } from '../model/user-access.js';

const ax = axios.create();
const mock = new AxiosMockAdapter(ax as never);
const service = new UserAccessService(ax);

const namespace = 'finos';
const domain = 'payments';

const grant1: UserAccess = { userAccessId: 1, username: 'alice', permission: 'read', namespace };
const grant2: UserAccess = { userAccessId: 2, username: 'bob', permission: 'write', namespace };
const wildcardGrant: UserAccess = { userAccessId: 3, username: '*', permission: 'read', namespace };
const domainGrant: UserAccess = { userAccessId: 10, username: 'carol', permission: 'admin', domain };

afterEach(() => mock.reset());

describe('UserAccessService', () => {

    // ──────────────────────────────────────────────────
    // getCurrentUserAccess
    // ──────────────────────────────────────────────────
    describe('getCurrentUserAccess', () => {
        it('returns grants from the current user endpoint', async () => {
            mock.onGet('/api/calm/user-access/current').reply(200, [grant1, wildcardGrant]);

            const result = await service.getCurrentUserAccess();
            expect(result).toEqual([grant1, wildcardGrant]);
        });

        it('returns empty array when response is empty', async () => {
            mock.onGet('/api/calm/user-access/current').reply(200, []);

            const result = await service.getCurrentUserAccess();
            expect(result).toEqual([]);
        });

        it('returns empty array when response is not an array', async () => {
            mock.onGet('/api/calm/user-access/current').reply(200, null);

            const result = await service.getCurrentUserAccess();
            expect(result).toEqual([]);
        });

        it('includes wildcard grants in the result', async () => {
            mock.onGet('/api/calm/user-access/current').reply(200, [grant1, wildcardGrant]);

            const result = await service.getCurrentUserAccess();
            expect(result.some((g) => g.username === '*')).toBe(true);
        });

        it('rejects on server error', async () => {
            mock.onGet('/api/calm/user-access/current').reply(500);

            await expect(service.getCurrentUserAccess()).rejects.toThrow();
        });
    });

    // ──────────────────────────────────────────────────
    // getNamespaceUserAccess
    // ──────────────────────────────────────────────────
    describe('getNamespaceUserAccess', () => {
        it('returns grants for the given namespace', async () => {
            mock.onGet(`/api/calm/namespaces/${namespace}/user-access`).reply(200, [grant1, grant2]);

            const result = await service.getNamespaceUserAccess(namespace);
            expect(result).toEqual([grant1, grant2]);
        });

        it('returns empty array when no grants exist', async () => {
            mock.onGet(`/api/calm/namespaces/${namespace}/user-access`).reply(200, []);

            const result = await service.getNamespaceUserAccess(namespace);
            expect(result).toEqual([]);
        });

        it('rejects on server error', async () => {
            mock.onGet(`/api/calm/namespaces/${namespace}/user-access`).reply(500);

            await expect(service.getNamespaceUserAccess(namespace)).rejects.toThrow();
        });
    });

    // ──────────────────────────────────────────────────
    // grantNamespaceAccess
    // ──────────────────────────────────────────────────
    describe('grantNamespaceAccess', () => {
        const request: UserAccessRequest = { username: 'alice', permission: 'read' };

        it('posts to the correct endpoint and returns the created grant', async () => {
            mock.onPost(`/api/calm/namespaces/${namespace}/user-access`).reply(201, grant1);

            const result = await service.grantNamespaceAccess(namespace, request);
            expect(result).toEqual(grant1);
        });

        it('sends the request body', async () => {
            mock.onPost(`/api/calm/namespaces/${namespace}/user-access`, request).reply(201, grant1);

            const result = await service.grantNamespaceAccess(namespace, request);
            expect(result).toEqual(grant1);
        });

        it('rejects on server error', async () => {
            mock.onPost(`/api/calm/namespaces/${namespace}/user-access`).reply(400);

            await expect(service.grantNamespaceAccess(namespace, request)).rejects.toThrow();
        });
    });

    // ──────────────────────────────────────────────────
    // revokeNamespaceAccess
    // ──────────────────────────────────────────────────
    describe('revokeNamespaceAccess', () => {
        it('sends DELETE to the correct endpoint', async () => {
            mock.onDelete(`/api/calm/namespaces/${namespace}/user-access/1`).reply(204);

            await expect(service.revokeNamespaceAccess(namespace, 1)).resolves.toBeUndefined();
        });

        it('rejects when the grant is not found', async () => {
            mock.onDelete(`/api/calm/namespaces/${namespace}/user-access/999`).reply(404);

            await expect(service.revokeNamespaceAccess(namespace, 999)).rejects.toThrow();
        });
    });

    // ──────────────────────────────────────────────────
    // getDomainUserAccess
    // ──────────────────────────────────────────────────
    describe('getDomainUserAccess', () => {
        it('returns grants for the given domain', async () => {
            mock.onGet(`/api/calm/domains/${domain}/user-access`).reply(200, [domainGrant]);

            const result = await service.getDomainUserAccess(domain);
            expect(result).toEqual([domainGrant]);
        });

        it('returns empty array when response body is not an array', async () => {
            mock.onGet(`/api/calm/domains/${domain}/user-access`).reply(200, null);

            const result = await service.getDomainUserAccess(domain);
            expect(result).toEqual([]);
        });

        it('rejects on server error', async () => {
            mock.onGet(`/api/calm/domains/${domain}/user-access`).reply(500);

            await expect(service.getDomainUserAccess(domain)).rejects.toThrow();
        });
    });

    // ──────────────────────────────────────────────────
    // grantDomainAccess
    // ──────────────────────────────────────────────────
    describe('grantDomainAccess', () => {
        const request: UserAccessRequest = { username: 'carol', permission: 'admin' };

        it('posts to the correct endpoint and returns the created grant', async () => {
            mock.onPost(`/api/calm/domains/${domain}/user-access`).reply(201, domainGrant);

            const result = await service.grantDomainAccess(domain, request);
            expect(result).toEqual(domainGrant);
        });

        it('rejects on server error', async () => {
            mock.onPost(`/api/calm/domains/${domain}/user-access`).reply(400);

            await expect(service.grantDomainAccess(domain, request)).rejects.toThrow();
        });
    });

    // ──────────────────────────────────────────────────
    // revokeDomainAccess
    // ──────────────────────────────────────────────────
    describe('revokeDomainAccess', () => {
        it('sends DELETE to the correct endpoint', async () => {
            mock.onDelete(`/api/calm/domains/${domain}/user-access/10`).reply(204);

            await expect(service.revokeDomainAccess(domain, 10)).resolves.toBeUndefined();
        });

        it('rejects when the grant is not found', async () => {
            mock.onDelete(`/api/calm/domains/${domain}/user-access/999`).reply(404);

            await expect(service.revokeDomainAccess(domain, 999)).rejects.toThrow();
        });
    });
});
