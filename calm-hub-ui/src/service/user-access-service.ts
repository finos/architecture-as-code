import { AxiosInstance } from 'axios';
import { getAuthHeaders } from '../authService.js';
import { UserAccess, UserAccessRequest } from '../model/user-access.js';
import { apiClient } from './utils/api-client.js';

export class UserAccessService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        this.ax = axiosInstance ?? apiClient;
    }

    public async getCurrentUserAccess(): Promise<UserAccess[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get('/api/calm/user-access/current', { headers })
            .then((res) => (Array.isArray(res.data) ? res.data : []))
            .catch((error) => {
                const errorMessage = 'Error fetching current user access:';
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async getNamespaceUserAccess(namespace: string): Promise<UserAccess[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${encodeURIComponent(namespace)}/user-access`, { headers })
            .then((res) => (Array.isArray(res.data) ? res.data : []))
            .catch((error) => {
                const errorMessage = `Error fetching user access for namespace ${namespace}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async grantNamespaceAccess(namespace: string, request: UserAccessRequest): Promise<void> {
        const headers = await getAuthHeaders();
        return this.ax
            .post(`/api/calm/namespaces/${encodeURIComponent(namespace)}/user-access`, request, { headers })
            .then(() => undefined)
            .catch((error) => {
                const errorMessage = `Error granting access on namespace ${namespace}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async revokeNamespaceAccess(namespace: string, userAccessId: number): Promise<void> {
        const headers = await getAuthHeaders();
        return this.ax
            .delete(`/api/calm/namespaces/${encodeURIComponent(namespace)}/user-access/${userAccessId}`, { headers })
            .then(() => undefined)
            .catch((error) => {
                const errorMessage = `Error revoking access ${userAccessId} on namespace ${namespace}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async getDomainUserAccess(domain: string): Promise<UserAccess[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/domains/${encodeURIComponent(domain)}/user-access`, { headers })
            .then((res) => (Array.isArray(res.data) ? res.data : []))
            .catch((error) => {
                const errorMessage = `Error fetching user access for domain ${domain}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async grantDomainAccess(domain: string, request: UserAccessRequest): Promise<void> {
        const headers = await getAuthHeaders();
        return this.ax
            .post(`/api/calm/domains/${encodeURIComponent(domain)}/user-access`, request, { headers })
            .then(() => undefined)
            .catch((error) => {
                const errorMessage = `Error granting access on domain ${domain}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async revokeDomainAccess(domain: string, userAccessId: number): Promise<void> {
        const headers = await getAuthHeaders();
        return this.ax
            .delete(`/api/calm/domains/${encodeURIComponent(domain)}/user-access/${userAccessId}`, { headers })
            .then(() => undefined)
            .catch((error) => {
                const errorMessage = `Error revoking access ${userAccessId} on domain ${domain}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }
}
