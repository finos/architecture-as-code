import axios, { AxiosInstance } from 'axios';
import { getAuthHeaders } from '../authService.js';
import { ControlDetail } from '../model/control.js';

export class ControlService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = axios.create();
        }
    }

    public async fetchDomains(): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get('/calm/domains', { headers })
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
            .get(`/calm/domains/${encodeURIComponent(domain)}/controls`, { headers })
            .then((res) => {
                return Array.isArray(res.data?.values) ? res.data.values : [];
            })
            .catch((error) => {
                const errorMessage = `Error fetching controls for domain ${domain}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchRequirementVersions(domain: string, controlId: number): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/domains/${encodeURIComponent(domain)}/controls/${controlId}/requirement/versions`, { headers })
            .then((res) => {
                return Array.isArray(res.data?.values) ? res.data.values : [];
            })
            .catch((error) => {
                const errorMessage = `Error fetching requirement versions for control ${controlId}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchRequirementForVersion(domain: string, controlId: number, version: string): Promise<unknown> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/domains/${encodeURIComponent(domain)}/controls/${controlId}/requirement/versions/${encodeURIComponent(version)}`, { headers })
            .then((res) => res.data)
            .catch((error) => {
                const errorMessage = `Error fetching requirement version ${version} for control ${controlId}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchConfigurationsForControl(domain: string, controlId: number): Promise<number[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/domains/${encodeURIComponent(domain)}/controls/${controlId}/configurations`, { headers })
            .then((res) => {
                return Array.isArray(res.data?.values) ? res.data.values : [];
            })
            .catch((error) => {
                const errorMessage = `Error fetching configurations for control ${controlId}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchConfigurationVersions(domain: string, controlId: number, configId: number): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/domains/${encodeURIComponent(domain)}/controls/${controlId}/configurations/${configId}/versions`, { headers })
            .then((res) => {
                return Array.isArray(res.data?.values) ? res.data.values : [];
            })
            .catch((error) => {
                const errorMessage = `Error fetching configuration versions for config ${configId}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchConfigurationForVersion(domain: string, controlId: number, configId: number, version: string): Promise<unknown> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/domains/${encodeURIComponent(domain)}/controls/${controlId}/configurations/${configId}/versions/${encodeURIComponent(version)}`, { headers })
            .then((res) => res.data)
            .catch((error) => {
                const errorMessage = `Error fetching configuration version ${version} for config ${configId}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }
}
