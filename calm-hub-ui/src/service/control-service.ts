import { AxiosInstance } from 'axios';
import { getAuthHeaders } from '../authService.js';
import {
    ControlConfigDetail,
    ControlConfigurationDoc,
    ControlDetail,
    ControlRequirementDoc,
} from '../model/control.js';
import { apiClient } from './utils/api-client.js';
import type { ResourceTags } from '../model/search.js';

export class ControlService {
    private readonly ax: AxiosInstance;

    private static withTags(url: string, tags?: ResourceTags): string {
        if (!tags?.path && !tags?.variant) return url;
        const query = new URLSearchParams();
        if (tags.path) query.set('path', tags.path);
        if (tags.variant) query.set('variant', tags.variant);
        return `${url}?${query.toString()}`;
    }

    constructor(axiosInstance?: AxiosInstance) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = apiClient;
        }
    }

    public async fetchDomains(): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get('/api/calm/domains', { headers })
            .then((res) => {
                const values = Array.isArray(res.data?.values) ? res.data.values : [];
                return values.filter((v: unknown): v is string => typeof v === 'string');
            })
            .catch((error) => {
                const errorMessage = 'Error fetching domains:';
                console.error(errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchControlsForDomain(domain: string): Promise<ControlDetail[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/domains/${encodeURIComponent(domain)}/controls`, { headers })
            .then((res) => {
                return Array.isArray(res.data?.values) ? res.data.values : [];
            })
            .catch((error) => {
                const errorMessage = `Error fetching controls for domain ${domain}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchRequirementVersions(domain: string, controlId: string, tags?: ResourceTags): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(ControlService.withTags(`/api/calm/domains/${encodeURIComponent(domain)}/controls/${controlId}/requirement/versions`, tags), { headers })
            .then((res) => {
                return Array.isArray(res.data?.values) ? res.data.values : [];
            })
            .catch((error) => {
                const errorMessage = `Error fetching requirement versions for control ${controlId}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchRequirementForVersion(domain: string, controlId: string, version: string, tags?: ResourceTags): Promise<ControlRequirementDoc> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(ControlService.withTags(`/api/calm/domains/${encodeURIComponent(domain)}/controls/${controlId}/requirement/versions/${encodeURIComponent(version)}`, tags), { headers })
            .then((res) => res.data as ControlRequirementDoc)
            .catch((error) => {
                const errorMessage = `Error fetching requirement version ${version} for control ${controlId}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchConfigurationsForControl(domain: string, controlId: string, tags?: ResourceTags): Promise<ControlConfigDetail[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(ControlService.withTags(`/api/calm/domains/${encodeURIComponent(domain)}/controls/${controlId}/configurations`, tags), { headers })
            .then((res) => {
                return Array.isArray(res.data?.values) ? res.data.values : [];
            })
            .catch((error) => {
                const errorMessage = `Error fetching configurations for control ${controlId}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchConfigurationVersions(domain: string, controlId: string, configId: string, tags?: ResourceTags): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(ControlService.withTags(`/api/calm/domains/${encodeURIComponent(domain)}/controls/${controlId}/configurations/${configId}/versions`, tags), { headers })
            .then((res) => {
                return Array.isArray(res.data?.values) ? res.data.values : [];
            })
            .catch((error) => {
                const errorMessage = `Error fetching configuration versions for config ${configId}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchConfigurationForVersion(domain: string, controlId: string, configId: string, version: string, tags?: ResourceTags): Promise<ControlConfigurationDoc> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(ControlService.withTags(`/api/calm/domains/${encodeURIComponent(domain)}/controls/${controlId}/configurations/${configId}/versions/${encodeURIComponent(version)}`, tags), { headers })
            .then((res) => res.data as ControlConfigurationDoc)
            .catch((error) => {
                const errorMessage = `Error fetching configuration version ${version} for config ${configId}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }
}
