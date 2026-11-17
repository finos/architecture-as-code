import axios, { AxiosInstance, isAxiosError } from 'axios';
import { getAuthHeaders } from '../authService.js';
import { isBuiltInExtension } from '../extensions/extensionIdentity.js';
import { ExtensionContext, ExtensionPoint, ExtensionRoute, ExtensionSummary } from '../model/extensions.js';
import type { Notation } from '../model/lens.js';
import type { DecoratorView } from '../visualizer/contracts/contracts.js';
import { authStore } from './utils/auth-store.js';

/** The extension contract version this UI reads. The registry and each blocks reply give theirs. */
export const SUPPORTED_HUB_API = 0;

type RegistryEntry = ExtensionSummary & { contributes: { 'decorator-views'?: unknown } };

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const UI_POINTS: readonly ExtensionPoint[] = ['screen', 'designer-tab', 'landing-card', 'detail-panel', 'action'];

const hasStrings = (value: unknown, fields: readonly string[]) =>
    isObject(value) && fields.every((field) => typeof value[field] === 'string');

// Hub always sends these fields. The pages read them outside an error boundary, so a malformed entry must not reach them.
function isRegistryEntry(value: unknown): value is RegistryEntry {
    if (!isObject(value) || value.hubApi !== SUPPORTED_HUB_API || typeof value.id !== 'string') return false;
    const { routes, contributes } = value;
    return Array.isArray(routes) && routes.every((route) => hasStrings(route, ['id', 'method', 'path']))
        && isObject(contributes)
        && UI_POINTS.every((point) => {
            const entries = contributes[point];
            return entries === undefined || (Array.isArray(entries) && entries.every((entry) => hasStrings(entry, ['id', 'title', 'route'])));
        })
        && (contributes['diagram-lens'] === undefined || (Array.isArray(contributes['diagram-lens'])
            && contributes['diagram-lens'].every((entry) => isObject(entry) && hasStrings(entry, ['id', 'title', 'route', 'notation'])
                && (entry.params === undefined || isObject(entry.params)))));
}

// A logo is decoration: a malformed one goes, and the extension stays.
function withValidLogo(entry: RegistryEntry): RegistryEntry {
    const { logo } = entry as { logo?: unknown };
    const valid = logo === undefined
        || (hasStrings(logo, ['light']) && ((logo as { dark?: unknown }).dark === undefined || hasStrings(logo, ['dark'])));
    return valid ? entry : { ...entry, logo: undefined };
}

function keepRegistryEntry(value: unknown): value is RegistryEntry {
    if (isRegistryEntry(value)) return true;
    const id = isObject(value) && typeof value.id === 'string' ? value.id : undefined;
    console.warn('%s', id === undefined ? 'Dropped an extension registry entry with no id' : `Dropped extension registry entry: ${id}`);
    return false;
}

/** A failed registry load. `signedOut` is true for a 401, which opens the sign-in prompt. */
export class ExtensionRegistryError extends Error {
    constructor(message: string, readonly signedOut: boolean) {
        super(message);
    }
}

/** A failed extension call. `problem` holds the title and detail of an `application/problem+json` reply. */
export class ExtensionCallError extends Error {
    constructor(readonly problem?: { title?: string; detail?: string }) {
        super('Error calling extension');
    }
}

function problemOf(error: unknown): ExtensionCallError['problem'] {
    const data: unknown = isAxiosError(error) ? error.response?.data : undefined;
    if (!isObject(data)) return undefined;
    const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 500) : undefined);
    // A refusal by Hub itself has an error message, not a problem title.
    const problem = { title: text(data.title) ?? text(data.error), detail: text(data.detail) };
    return problem.title || problem.detail ? problem : undefined;
}

const isSignedOut = (error: unknown) => isAxiosError(error) && error.response?.status === 401;

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

// Hub refuses these parts of a path (ADR 0011), also a look-alike of /, \, ., %, @ or ;. The same rule as
// @finos/calm-shared buildExtensionRequest; calm-hub/src/test/resources/extensions-test/path-values.json ties the copies together.
function isPathValue(value: string): boolean {
    return value !== '' && value !== '.' && !LONE_SURROGATE.test(value)
        // eslint-disable-next-line no-control-regex
        && !/\.\.|[/\\%@\u0000-\u001f\u007f\u037e\u2024-\u2026\u2044\u2100\u2101\u2105\u2106\u2215\u2216\u29f5\u29f8\ufe14\ufe19\ufe30\ufe52\ufe54\ufe68\ufe6a\ufe6b\uff05\uff0e\uff0f\uff1b\uff20\uff3c]/.test(value);
}

/** Hub refuses an encoded control character in a query, and axios throws on a lone surrogate. */
export function isQueryValue(value: string): boolean {
    // eslint-disable-next-line no-control-regex
    return !LONE_SURROGATE.test(value) && !/[\u0000-\u001f\u007f]/.test(value);
}

/** The resource context, and for a lens its view parameters. Hub reserves the context names, so they cannot clash. */
export type ExtensionQuery = ExtensionContext & Record<string, string | undefined>;

export function extensionRequest(id: string, route: ExtensionRoute, context: ExtensionQuery) {
    const values: Record<string, string | undefined> = { ...context };
    const path = route.path.replace(/\{([^}]+)\}/g, (_, key: string) => {
        const value = values[key];
        if (typeof value !== 'string') throw new Error(`Missing extension context: ${key}`);
        if (!isPathValue(value)) throw new Error(`Invalid extension context: ${key}`);
        return encodeURIComponent(value);
    });
    if (!path.startsWith('/') || path.split('/').some((part) => part === '.' || part === '..')) {
        throw new Error('Invalid extension route');
    }
    for (const [key, value] of Object.entries(context)) {
        if (typeof value === 'string' && !isQueryValue(value)) throw new Error(`Invalid extension context: ${key}`);
    }
    return { url: `/api/calm/extensions/${encodeURIComponent(id)}/api${path}`, params: context };
}

export class ExtensionService {
    private readonly ax: AxiosInstance;
    private registry?: Promise<RegistryEntry[]>;
    private core?: Promise<Notation>;

    constructor(axiosInstance?: AxiosInstance) {
        // Not apiClient: an extension failure stays in its slot and must not open the global auth or outage page.
        this.ax = axiosInstance ?? axios.create();
    }

    private loadRegistry(): Promise<RegistryEntry[]> {
        this.registry ??= getAuthHeaders()
            .then((headers) => this.ax.get<{ values?: unknown }>('/api/calm/extensions', { headers }))
            .then((res) => (Array.isArray(res.data?.values) ? (res.data.values as unknown[]) : []))
            .then((values) => values.filter(keepRegistryEntry).map(withValidLogo))
            .catch((error) => {
                this.registry = undefined;
                // The registry is a Hub call, so a 401 means the Hub session ended. An extension call keeps its 401 in its slot.
                if (isSignedOut(error)) authStore.setAuthError(401);
                return Promise.reject(error);
            });
        return this.registry;
    }

    public async fetchExtensions(): Promise<ExtensionSummary[]> {
        return this.loadRegistry().catch((error) => {
            console.error('%s', 'Error fetching extensions:', error);
            return Promise.reject(new ExtensionRegistryError('Error fetching extensions', isSignedOut(error)));
        });
    }

    public async fetchDecoratorViews(): Promise<DecoratorView[]> {
        return this.loadRegistry()
            .then((values) =>
                values.flatMap((extension) => {
                    const views = extension.contributes['decorator-views'];
                    // One bad value must not fail the load, which would replace every view with the built-in ones.
                    if (!Array.isArray(views)) return [];
                    const source = {
                        id: extension.id,
                        name: extension.name || extension.id,
                        builtIn: isBuiltInExtension(extension.id),
                    };
                    return (views as DecoratorView[]).map((view) => ({ ...view, source }));
                })
            )
            .catch((error) => {
                const errorMessage = 'Error fetching decorator views:';
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    /** The notation of a lens. Hub checked it at start-up. */
    public async fetchLensNotation(id: string, lens: string, signal?: AbortSignal): Promise<Notation> {
        const headers = await getAuthHeaders();
        return this.ax
            .get<Notation>(`/api/calm/extensions/${encodeURIComponent(id)}/lenses/${encodeURIComponent(lens)}/notation`, { headers, signal })
            .then((res) => res.data);
    }

    /** Hub's core notation, behind every lens notation. It changes only with Hub, so the UI reads it once. */
    public fetchCoreNotation(): Promise<Notation> {
        this.core ??= getAuthHeaders()
            .then((headers) => this.ax.get<Notation>('/api/calm/extensions/notations/core', { headers }))
            .then((res) => res.data)
            .catch((error) => {
                this.core = undefined;
                return Promise.reject(error);
            });
        return this.core;
    }

    public async call(id: string, route: ExtensionRoute, context: ExtensionQuery, signal?: AbortSignal): Promise<unknown> {
        const headers = await getAuthHeaders();
        const request = extensionRequest(id, route, context);
        return this.ax
            .request({
                ...request,
                method: route.method,
                headers,
                signal,
                ...(!['GET', 'DELETE'].includes(route.method) ? { data: context } : {}),
            })
            .then((res) => res.data)
            .catch((error) => {
                console.error('%s', 'Error calling extension:', error);
                return Promise.reject(new ExtensionCallError(problemOf(error)));
            });
    }
}
