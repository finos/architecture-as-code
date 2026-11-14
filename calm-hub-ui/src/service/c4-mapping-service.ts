import { AxiosInstance, isAxiosError } from 'axios';
import { getAuthHeaders } from '../authService.js';
import { apiClient } from './utils/api-client.js';

/** The `c4-mapping` config that applies to a namespace (#3727). */
export interface NamespaceC4Mapping {
    /** The namespace that sets the default. Another namespace than the one asked for when `inherited`. */
    namespace: string;
    configId: number;
    version: string;
    inherited: boolean;
    config: unknown;
}

const HUB_CONFIG_PATH = /^(?:\/api)?\/calm\/namespaces\/[^/]+\/configs\/c4-mapping\/[^/]+\/versions\/[^/]+$/;

export class C4MappingService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        this.ax = axiosInstance ?? apiClient;
    }

    /** The namespace's default mapping, or its nearest ancestor's. Undefined when no namespace in the chain sets one. */
    public async fetchDefaultMapping(namespace: string): Promise<NamespaceC4Mapping | undefined> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${encodeURIComponent(namespace)}/configs/c4-mapping/default`, { headers })
            .then((res) => res.data as NamespaceC4Mapping)
            .catch((error) => {
                if (isAxiosError(error) && error.response?.status === 404) return undefined;
                const errorMessage = `Error fetching the C4 mapping of namespace ${namespace}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    /**
     * The mapping at an `extends` URL. A config on this Hub is read through the API with the user's credentials.
     * Any other URL is fetched without them.
     */
    public async fetchMappingAt(url: string, hostname: string = window.location.hostname): Promise<unknown> {
        const parsed = new URL(url, window.location.origin);
        const onThisHub = parsed.hostname === hostname && HUB_CONFIG_PATH.test(parsed.pathname);
        const request = onThisHub
            ? this.ax.get(parsed.pathname.startsWith('/api/') ? parsed.pathname : `/api${parsed.pathname}`, { headers: await getAuthHeaders() })
            : this.ax.get(parsed.href);
        return request
            .then((res) => res.data)
            .catch((error) => {
                const errorMessage = `Error fetching the C4 mapping at ${url}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }
}
