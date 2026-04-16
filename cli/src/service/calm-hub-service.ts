import axios, { Axios } from 'axios';
import { CLIConfig } from "../cli-config";
import { CalmDocumentType } from '@finos/calm-shared/src/document-loader/document-loader';
import * as calmHubUrls from './calm-hub-urls';

export class CalmHubService {
    private readonly ax: Axios;

    constructor(calmHubUrl: string, axiosInstance?: Axios) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        }
        else {
            this.ax = axios.create({
                baseURL: calmHubUrl,
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
    }

    static fromCliConfig(config: CLIConfig): CalmHubService {
        if (!config.calmHubUrl) {
            throw new Error('No CalmHub instance configured. Please set --calm-hub-url or calmHubUrl in ~/.calm.json!')
        }
        return new CalmHubService(config.calmHubUrl);
    }

    async getCalmHubResourceVersions(namespace: string, name: string): Promise<string[]> {
        // TODO handle 404s and other errors
        return await this.ax.get(calmHubUrls.calmHubResourceVersionsUrl(namespace, name))
    }

    async getCalmHubResourceLatestVersion(namespace: string, name: string): Promise<string[]> {
        // TODO handle 404s and other errors
        return await this.ax.get(calmHubUrls.calmHubResourceLatestVersionUrl(namespace, name))
    }

    async getCalmHubResourceSpecificVersion(namespace: string, name: string, version: string): Promise<string[]> {
        // TODO handle 404s and other errors
        // TODO validate version string
        return await this.ax.get(calmHubUrls.calmHubResourceSpecificVersionUrl(namespace, name, version))
    }

    async createNewCalmResource(namespace: string, name: string, data: object): Promise<boolean> {
        return await this.ax.post(calmHubUrls.calmHubResourceLatestVersionUrl(namespace, name), data);
    }
}