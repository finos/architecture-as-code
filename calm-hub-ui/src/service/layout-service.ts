import axios, { AxiosInstance } from 'axios';
import { getAuthHeaders } from '../authService.js';
import { apiClient } from './utils/api-client.js';
import { CalmLayout } from '../model/layout.js';

/** The URL segment (and backend resource family) a layout belongs to. */
export type LayoutResourceType = 'architectures' | 'patterns';

function resourceLabel(urlType: LayoutResourceType): string {
    return urlType === 'architectures' ? 'architecture' : 'pattern';
}

/**
 * Maps a failed layout request to a message worth showing the user, not just
 * logging. `useDefaultLayout` assigns this straight to `saveError`, which
 * DiagramSection now renders inline (see the layout-save-error banner) — so
 * unlike the generic `errorMessage` prefix logged alongside it, this one has
 * to mean something to someone who isn't reading the console.
 */
function layoutFailureMessage(action: 'save' | 'load', urlType: LayoutResourceType, error: unknown): string {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const label = resourceLabel(urlType);

    // 403 and 413 are worded per-action: "write access" and "too large to store"
    // are both write-side facts and would be actively misleading on a failed GET
    // (a read-scoped user can still be forbidden, just not for the write reason;
    // a GET has no body for the server to reject as oversized).
    if (action === 'save') {
        switch (status) {
            case 403:
                return "Couldn't save the default layout — you don't have write access to this namespace.";
            case 413:
                return "Couldn't save the default layout — it's too large to store.";
            case 404:
                return `Couldn't save the default layout — this ${label} no longer exists.`;
        }
    } else if (status === 403) {
        return "Couldn't load the default layout — you don't have access to this namespace.";
    } else if (status === 404) {
        return `Couldn't load the default layout — this ${label} no longer exists.`;
    }

    return status
        ? `Couldn't ${action} the default layout — the server returned ${status}.`
        : `Couldn't ${action} the default layout — the server couldn't be reached.`;
}

/**
 * Manages the shared, default layout saved for an architecture or a pattern — the
 * server-side counterpart to the browser-local scratch layer in
 * `node-position-service.tsx`. There is exactly one default layout per resource;
 * saving is always an upsert. Architectures and patterns are separate backend
 * resource families (`.../architectures/{id}/layout` vs `.../patterns/{id}/layout`,
 * distinct storage collections) — see `PatternLayoutStore`'s class javadoc on the
 * backend for why — so every call site must say which one it means via `urlType`.
 */
export class LayoutService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = apiClient;
        }
    }

    /** The saved default layout for an architecture or pattern, or null when none has been saved. */
    public async getDefaultLayout(namespace: string, id: number, urlType: LayoutResourceType): Promise<CalmLayout | null> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${encodeURIComponent(namespace)}/${urlType}/${id}/layout`, { headers })
            .then((res) => res.data as CalmLayout)
            .catch((error) => {
                if (error?.response?.status === 404) {
                    return null;
                }
                const errorMessage = `Error fetching default layout for ${resourceLabel(urlType)} ${id} in namespace ${namespace}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(layoutFailureMessage('load', urlType, error)));
            });
    }

    /** Save (create or overwrite) the default layout for an architecture or pattern. */
    public async saveDefaultLayout(namespace: string, id: number, layout: CalmLayout, urlType: LayoutResourceType): Promise<void> {
        const headers = await getAuthHeaders();
        return this.ax
            .put(`/api/calm/namespaces/${encodeURIComponent(namespace)}/${urlType}/${id}/layout`, layout, { headers })
            .then(() => undefined)
            .catch((error) => {
                const errorMessage = `Error saving default layout for ${resourceLabel(urlType)} ${id} in namespace ${namespace}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(layoutFailureMessage('save', urlType, error)));
            });
    }
}
