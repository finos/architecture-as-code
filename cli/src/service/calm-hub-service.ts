import axios, { Axios, AxiosResponse } from 'axios';
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

    async createNewCalmResource(namespace: string, name: string, type: CalmDocumentType,data: object, description?: string): Promise<boolean> {
        const createRequest : FrontControllerCreateRequest = {
            type: type.toUpperCase(),
            json: JSON.stringify(data),
            name,
            description: description || `Created via CALM CLI on ${new Date().toISOString()}`
        }
        return await this.ax.post(calmHubUrls.calmHubResourceLatestVersionUrl(namespace, name), createRequest);
    }
    
    /**
     * Update an existing CALM Front Controller resource. 
     * Currently always does a MINOR version bump.
     * @param namespace Namespace of resource to update
     * @param name Name of Front Controller resource to update
     * @param data Object to update with. Note this is not an upsert but will replace the data.
     * @returns The version of the new resource created.
     */
    async updateCalmResource(namespace: string, name: string, data: object): Promise<string> {
        const updateRequest: FrontControllerUpdateRequest = {
            json: JSON.stringify(data),
            changeType: 'MINOR' // TODO determine change type based on diff between current and new version
        }
        const response: AxiosResponse = await this.ax.post(calmHubUrls.calmHubResourceLatestVersionUrl(namespace, name), updateRequest);
        const locationHeader = response.headers['location'] || response.headers['Location'];
        return extractVersionFromLocationHeader(locationHeader);
    }
}

export function extractVersionFromLocationHeader(locationHeader: string): string {
    if (!locationHeader) {
        throw new Error('No Location header returned from CalmHub on update - cannot determine new version');
    }
    const match = locationHeader.match(/\/versions\/([^\/]+)$/);
    if (!match || match.length < 2) {
        throw new Error('Unexpected Location header format: ' + locationHeader);
    }
    return match[1];
}

interface FrontControllerCreateRequest {
    type: string;
    json: string,
    name?: string,
    description?: string,
}

type CalmHubChangeType = 'MAJOR' | 'MINOR' | 'PATCH';

interface FrontControllerUpdateRequest {
    json: string,
    changeType: CalmHubChangeType
}