import type { Path } from 'react-router-dom';
import { resourcePath, screenRoutePath } from '../hub/routes.js';
import { EXACT_VERSION_PARAM, EXTENSION_PARAM } from '../hub/components/diagram-section/tabs/diagramTabRegistry.js';
import type { Destination, ExtensionContext, HubTarget, ResourceTarget, ScreenTarget } from '../model/extensions.js';
import { isQueryValue } from '../service/extension-service.js';

/**
 * The bounds of the view state in a screen URL, in characters (see `isWithin`). Screen params go to the screen route;
 * table keys (#3801) stay in the browser. The two are counted apart, and the resource context counts in neither.
 * `routeQuery` is the budget of the screen route's query: the resource context and the screen params, form-encoded,
 * where one character takes up to twelve. It leaves room for the path inside Hub's request-line limit of 4096 bytes.
 * ExtensionDestinations checks the same limits on the server.
 */
export const SCREEN_STATE_LIMITS = {
    params: 8,
    tableKeys: 12,
    paramName: 64,
    paramValue: 256,
    segment: 256,
    element: 256,
    tableFilter: 100,
    tableQuery: 200,
    routeQuery: 2048,
    href: 2048,
} as const;

/** The query names of the resource context. A screen param cannot take one. */
export const CONTEXT_PARAMS: readonly string[] = ['namespace', 'resource', 'resourceType', 'resourceId', 'version', 'selectedElement'];

const ID = /^[a-z][a-z0-9-]*$/;
const SCREEN_PARAM = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const TABLE_KEY = /^[a-z][a-z0-9-]{0,63}\.(filter|q|page)$/;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Whether a string has at most `max` characters. A length limit counts Unicode code points, as JSON Schema `maxLength`
 * does, not UTF-16 units: a character such as '𝄞' or an emoji is one character and two units.
 */
const isWithin = (value: string, max: number): boolean => value.length <= max || (value.length <= 2 * max && [...value].length <= max);

/** An extension sends data, so only http and https URLs become external links. */
export function safeHref(href: unknown): string | undefined {
    // Extension data is not typed at run time: a value that is not a string must not reach the length check.
    if (typeof href !== 'string' || href === '' || !isWithin(href, SCREEN_STATE_LIMITS.href)) return undefined;
    try {
        const url = new URL(href);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
    } catch {
        return undefined;
    }
}

/** A screen param: a name without a dot that is not a context name. */
export const isScreenParamName = (name: string): boolean => SCREEN_PARAM.test(name) && !CONTEXT_PARAMS.includes(name);

const isScreenParamValue = (value: unknown): value is string =>
    typeof value === 'string' && isWithin(value, SCREEN_STATE_LIMITS.paramValue) && isQueryValue(value);

/** A table key of #3801, such as `reviews.page=2`, with its value limits. */
export function isTableStateEntry(name: string, value: string): boolean {
    const kind = TABLE_KEY.exec(name)?.[1];
    if (kind === 'filter') return isWithin(value, SCREEN_STATE_LIMITS.tableFilter);
    if (kind === 'q') return isWithin(value, SCREEN_STATE_LIMITS.tableQuery);
    if (kind === 'page') return /^[1-9][0-9]{0,4}$/.test(value) && Number(value) >= 2 && Number(value) <= 10000;
    return false;
}

// A route part. resourcePath would throw on a missing part or a lone surrogate, and a browser resolves a dot segment,
// even encoded, so a "." or ".." part would open another page.
const isSegment = (part: unknown): part is string =>
    typeof part === 'string' &&
    part !== '' &&
    part !== '.' &&
    part !== '..' &&
    isWithin(part, SCREEN_STATE_LIMITS.segment) &&
    isQueryValue(part);

const isElement = (value: unknown): value is string =>
    typeof value === 'string' && value !== '' && isWithin(value, SCREEN_STATE_LIMITS.element) && isQueryValue(value);

function isResourceTarget(value: unknown): value is ResourceTarget {
    return (
        isObject(value) &&
        [value.namespace, value.type, value.id, value.version].every(isSegment) &&
        (value.element === undefined || isElement(value.element))
    );
}

function isHubTarget(value: unknown): value is HubTarget {
    if (!isResourceTarget(value)) return false;
    const { extension } = value as { extension?: unknown };
    return extension === undefined || (typeof extension === 'string' && ID.test(extension));
}

/**
 * The screen params of a link, or undefined when the link has a param that is neither a screen param nor a table key,
 * or more of a kind than its limit.
 */
function screenParams(value: unknown): Record<string, string> | undefined {
    if (value === undefined) return {};
    if (!isObject(value)) return undefined;
    const params: Record<string, string> = {};
    let tableKeys = 0;
    for (const [name, entry] of Object.entries(value)) {
        if (isScreenParamName(name) && isScreenParamValue(entry)) params[name] = entry;
        else if (typeof entry === 'string' && isTableStateEntry(name, entry)) tableKeys++;
        else return undefined;
    }
    const fits = Object.keys(params).length <= SCREEN_STATE_LIMITS.params && tableKeys <= SCREEN_STATE_LIMITS.tableKeys;
    return fits ? params : undefined;
}

/** Whether the resource context and the screen params, as the screen route gets them, are within `routeQuery`. */
function fitsRoute(context: ResourceTarget | undefined, params: Record<string, string>): boolean {
    const sent = new URLSearchParams(params);
    if (context) {
        for (const [name, value] of Object.entries(resourceContext(context))) if (value !== undefined) sent.set(name, value);
    }
    return sent.toString().length <= SCREEN_STATE_LIMITS.routeQuery;
}

function isScreenTarget(value: unknown): value is ScreenTarget {
    if (
        !isObject(value) ||
        typeof value.extension !== 'string' ||
        !ID.test(value.extension) ||
        typeof value.screen !== 'string' ||
        !ID.test(value.screen)
    ) {
        return false;
    }
    const { context } = value;
    if (context !== undefined && !isResourceTarget(context)) return false;
    const params = screenParams(value.params);
    return params !== undefined && fitsRoute(context, params);
}

/** A destination that Hub can open: exactly one of a safe `href`, a `hub` target or a `screen` target. Other fields are ignored. */
export function isDestination(value: unknown): value is Destination {
    if (!isObject(value)) return false;
    const kinds = (['href', 'hub', 'screen'] as const).filter((kind) => value[kind] !== undefined);
    if (kinds.length !== 1) return false;
    if (kinds[0] === 'href') return typeof value.href === 'string' && safeHref(value.href) !== undefined;
    return kinds[0] === 'hub' ? isHubTarget(value.hub) : isScreenTarget(value.screen);
}

/** The query that names a resource for an extension screen. `resource` is left out: the page derives it. */
function contextQuery(target: ResourceTarget): Record<string, string> {
    return {
        namespace: target.namespace,
        resourceType: target.type,
        resourceId: target.id,
        version: target.version,
        ...(target.element !== undefined ? { selectedElement: target.element } : {}),
    };
}

const location = (pathname: string, query: URLSearchParams): Path => {
    const search = query.toString();
    return { pathname, search: search ? `?${search}` : '', hash: '' };
};

/**
 * The Hub location of a destination: the only place that maps a typed target to a route. Undefined for an external
 * `href`, and for a destination that is not valid, so a link to it shows as text.
 */
export function destinationLocation(destination: Destination): Path | undefined {
    if (!isDestination(destination) || destination.href !== undefined) return undefined;
    if (destination.hub) {
        const { element, extension } = destination.hub;
        const query = new URLSearchParams();
        if (element !== undefined) query.set('node', element);
        if (extension !== undefined) query.set(EXTENSION_PARAM, extension);
        // A Hub link names its version, so a timeline must not move it, also when the link is copied.
        query.set(EXACT_VERSION_PARAM, '1');
        return location(resourcePath(destination.hub), query);
    }
    const { extension, screen, context, params } = destination.screen;
    const query = new URLSearchParams(context ? contextQuery(context) : {});
    for (const [name, value] of Object.entries(params ?? {})) query.set(name, value);
    return location(screenRoutePath(extension, screen), query);
}

/** The extension context of a resource target, with the names that extension routes and form targets already use. */
export function resourceContext(target: ResourceTarget): ExtensionContext {
    return {
        namespace: target.namespace,
        resource: `${target.type}/${target.id}`,
        resourceType: target.type,
        resourceId: target.id,
        version: target.version,
        selectedElement: target.element,
    };
}

export type ScreenQuery =
    { context?: ResourceTarget; params: Record<string, string>; problem?: never } | { problem: string; context?: never; params?: never };

/**
 * Reads the resource context and the screen params of an extension screen URL. A context must be complete, and the
 * params within their limit, or the screen does not load: a partial context would send the route a wrong target.
 * Table keys and other names stay in the URL and are not sent.
 */
export function readScreenQuery(query: URLSearchParams): ScreenQuery {
    let context: ResourceTarget | undefined;
    if (CONTEXT_PARAMS.some((name) => query.has(name))) {
        const element = query.get('selectedElement');
        const target = {
            namespace: query.get('namespace'),
            type: query.get('resourceType'),
            id: query.get('resourceId'),
            version: query.get('version'),
            ...(element !== null ? { element } : {}),
        };
        if (!isResourceTarget(target)) {
            return { problem: 'This link names an incomplete or invalid resource for this screen.' };
        }
        context = target;
    }
    const params: Record<string, string> = {};
    for (const [name, value] of query) {
        if (!isScreenParamName(name) || Object.hasOwn(params, name)) continue;
        if (!isScreenParamValue(value)) return { problem: `The view parameter "${name}" of this link is not valid.` };
        params[name] = value;
    }
    if (Object.keys(params).length > SCREEN_STATE_LIMITS.params) {
        return { problem: `This link has more than ${SCREEN_STATE_LIMITS.params} view parameters.` };
    }
    if (!fitsRoute(context, params)) return { problem: 'The resource and view parameters of this link are too long for the screen.' };
    return { context, params };
}
