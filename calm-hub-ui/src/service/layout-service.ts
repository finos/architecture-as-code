import axios, { AxiosInstance } from 'axios';
import { getAuthHeaders } from '../authService.js';
import { apiClient } from './utils/api-client.js';
import { CalmLayout } from '../model/layout.js';

/**
 * Maps a failed layout request to a message worth showing the user, not just
 * logging. `useDefaultLayout` assigns this straight to `saveError`, which
 * DiagramSection now renders inline (see the layout-save-error banner) — so
 * unlike the generic `errorMessage` prefix logged alongside it, this one has
 * to mean something to someone who isn't reading the console.
 */
function layoutFailureMessage(action: 'save' | 'load', error: unknown): string {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;

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
                return "Couldn't save the default layout — this architecture no longer exists.";
        }
    } else if (status === 403) {
        return "Couldn't load the default layout — you don't have access to this namespace.";
    } else if (status === 404) {
        return "Couldn't load the default layout — this architecture no longer exists.";
    }

    return status
        ? `Couldn't ${action} the default layout — the server returned ${status}.`
        : `Couldn't ${action} the default layout — the server couldn't be reached.`;
}

/**
 * Manages the shared, default layout saved for an architecture — the server-side
 * counterpart to the browser-local scratch layer in `node-position-service.tsx`.
 * There is exactly one default layout per architecture; saving is always an upsert.
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

    /** The saved default layout for an architecture, or null when none has been saved. */
    public async getDefaultLayout(namespace: string, architectureId: number): Promise<CalmLayout | null> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${encodeURIComponent(namespace)}/architectures/${architectureId}/layout`, { headers })
            .then((res) => res.data as CalmLayout)
            .catch((error) => {
                if (error?.response?.status === 404) {
                    return null;
                }
                const errorMessage = `Error fetching default layout for architecture ${architectureId} in namespace ${namespace}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(layoutFailureMessage('load', error)));
            });
    }

    /** Save (create or overwrite) the default layout for an architecture. */
    public async saveDefaultLayout(namespace: string, architectureId: number, layout: CalmLayout): Promise<void> {
        const headers = await getAuthHeaders();
        return this.ax
            .put(`/api/calm/namespaces/${encodeURIComponent(namespace)}/architectures/${architectureId}/layout`, layout, { headers })
            .then(() => undefined)
            .catch((error) => {
                const errorMessage = `Error saving default layout for architecture ${architectureId} in namespace ${namespace}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(layoutFailureMessage('save', error)));
            });
    }
}
