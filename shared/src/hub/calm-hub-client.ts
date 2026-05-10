import axios, { Axios } from 'axios';

export interface HubNamespaceSummary {
    name: string;
    description?: string;
}

export interface HubArchitectureSummary {
    id: number;
    name: string;
    versions: string[];
}

export interface HubArchitectureDetail {
    namespace: string;
    id: number;
    name: string;
    description?: string;
    version: string;
    architecture: string;
}

export interface HubCreateResult {
    id: number;
    version?: string;
    location: string;
}

export interface HubNamespaceCreateResult {
    name: string;
    location: string;
}

export class HubClientError extends Error {
    constructor(
        public readonly status: number,
        public readonly error: string,
        public readonly request: string
    ) {
        super(`Hub error ${status} on ${request}: ${error}`);
        this.name = 'HubClientError';
    }
}

export class CalmHubClient {
    private readonly ax: Axios;

    constructor(baseUrl: string, axiosInstance?: Axios) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = axios.create({
                baseURL: baseUrl,
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
    }

    // ── Namespaces ───────────────────────────────────────────────────────────

    async createNamespace(name: string, description?: string): Promise<HubNamespaceCreateResult> {
        const endpoint = 'POST /calm/namespaces';
        try {
            const response = await this.ax.post('/calm/namespaces', { name, description: description ?? '' });
            const location = (response.headers['location'] as string | undefined) ?? `/calm/namespaces/${name}`;
            return { name, location };
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    async listNamespaces(): Promise<HubNamespaceSummary[]> {
        const endpoint = 'GET /calm/namespaces';
        try {
            const response = await this.ax.get('/calm/namespaces');
            const values: HubNamespaceSummary[] = response.data?.values ?? [];
            return values;
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    // ── Architectures ────────────────────────────────────────────────────────

    async pushArchitecture(
        namespace: string,
        name: string,
        description: string,
        architectureJson: string
    ): Promise<HubCreateResult> {
        const endpoint = `POST /calm/namespaces/${namespace}/architectures`;
        try {
            const response = await this.ax.post(`/calm/namespaces/${namespace}/architectures`, {
                name,
                description,
                architectureJson
            });
            const location = response.headers['location'] as string;
            return this.parseVersionedLocation(location, endpoint);
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    async pushArchitectureVersion(
        namespace: string,
        id: number,
        version: string,
        name: string | undefined,
        description: string,
        architectureJson: string
    ): Promise<HubCreateResult> {
        const endpoint = `POST /calm/namespaces/${namespace}/architectures/${id}/versions/${version}`;
        try {
            const response = await this.ax.post(
                `/calm/namespaces/${namespace}/architectures/${id}/versions/${version}`,
                { name, description, architectureJson }
            );
            const location = response.headers['location'] as string;
            return this.parseVersionedLocation(location, endpoint);
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    async listArchitectures(namespace: string): Promise<HubArchitectureSummary[]> {
        const endpoint = `GET /calm/namespaces/${namespace}/architectures`;
        try {
            const response = await this.ax.get(`/calm/namespaces/${namespace}/architectures`);
            const items: { id: number; name: string; description?: string }[] =
                response.data?.values ?? [];
            const summaries = await Promise.all(
                items.map(async (item) => {
                    const versionsEndpoint = `GET /calm/namespaces/${namespace}/architectures/${item.id}/versions`;
                    try {
                        const vRes = await this.ax.get(
                            `/calm/namespaces/${namespace}/architectures/${item.id}/versions`
                        );
                        const versions: string[] = vRes.data?.values ?? [];
                        return { id: item.id, name: item.name, versions };
                    } catch (err) {
                        throw this.wrapError(err, versionsEndpoint);
                    }
                })
            );
            return summaries;
        } catch (err) {
            if (err instanceof HubClientError) throw err;
            throw this.wrapError(err, endpoint);
        }
    }

    async pullArchitecture(namespace: string, id: number, version: string): Promise<object> {
        const endpoint = `GET /calm/namespaces/${namespace}/architectures/${id}/versions/${version}`;
        try {
            const response = await this.ax.get(
                `/calm/namespaces/${namespace}/architectures/${id}/versions/${version}`
            );
            return response.data as object;
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Parses id and version from a Location header of the form
     * /calm/namespaces/{ns}/{resource-type}/{id}/versions/{version}
     */
    private parseVersionedLocation(location: string, endpoint: string): HubCreateResult {
        const match = /\/(\d+)\/versions\/([^/]+)$/.exec(location);
        if (!match) {
            throw new HubClientError(0, `Could not parse location header: ${location}`, endpoint);
        }
        return {
            id: parseInt(match[1], 10),
            version: match[2],
            location
        };
    }


    private wrapError(err: unknown, endpoint: string): HubClientError {
        if (err instanceof HubClientError) return err;
        if (axios.isAxiosError(err) && err.response) {
            const status = err.response.status;
            const body = err.response.data;
            let message: string;
            if (typeof body === 'string') {
                message = body;
            } else if (body && typeof body === 'object' && 'error' in body) {
                message = String((body as { error: string }).error);
            } else {
                message = err.message;
            }
            return new HubClientError(status, message, endpoint);
        }
        return new HubClientError(0, err instanceof Error ? err.message : String(err), endpoint);
    }
}
