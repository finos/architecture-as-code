/** A proxied route of an extension, as `GET /api/calm/extensions` lists it (ADR 0012). */
export interface HubExtensionRoute {
    id: string;
    method: string;
    path: string;
    scope: string;
    readOnly?: boolean;
}

export interface HubExtensionCommand {
    route: string;
    description?: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    destructive?: boolean;
    idempotent?: boolean;
}

/** An enabled extension. Hub leaves out the routes and commands that it cannot run. */
export interface HubExtension {
    id: string;
    version?: string;
    hubApi: number;
    name?: string;
    description?: string;
    provider?: string;
    routes?: HubExtensionRoute[];
    commands?: Record<string, HubExtensionCommand>;
    contributes?: Record<string, unknown>;
}

export interface HubExtensionRequest {
    method: string;
    /** Relative to the CALM Hub base URL, with the path parameters filled and encoded. */
    path: string;
    query: [string, string][];
    body?: Record<string, unknown>;
}

const PATH_PARAM = /\{([^{}]+)\}/g;

export function extensionProxyPath(extensionId: string, routePath: string): string {
    return `/api/calm/extensions/${encodeURIComponent(extensionId)}/api${routePath}`;
}

/**
 * Maps a command input to a request on the route (ADR 0012). Input properties that match a
 * `{param}` fill the path. The rest go to the query for GET and DELETE, and to the JSON body otherwise.
 * The extension validates the input (the REST proxy does not), so this checks only what it needs to build the request.
 * @param routes All the routes of the extension, so that a filled path cannot call another route.
 * @throws Error when a path parameter is missing, is not a string, number or boolean, or has a part that Hub refuses
 * in a path, when the filled path matches another route, or when a query name or value has a character that Hub
 * refuses in a query.
 */
export function buildExtensionRequest(
    extensionId: string,
    route: HubExtensionRoute,
    input: Record<string, unknown>,
    routes: HubExtensionRoute[] = [],
): HubExtensionRequest {
    const rest: Record<string, unknown> = { ...input };
    const path = route.path.replace(PATH_PARAM, (_match, name: string) => {
        const value = input[name];
        if (value === undefined || value === null) {
            throw new Error(`Input property '${name}' is required, because it fills the path ${route.path}`);
        }
        if (!isScalar(value)) {
            throw new Error(`Input property '${name}' must be a string, number or boolean, because it fills the path ${route.path}`);
        }
        const text = scalarText(value);
        if (!isPathValue(text)) {
            throw new Error(`Input property '${name}' ${PATH_VALUE_RULE}, because it fills the path ${route.path}`);
        }
        delete rest[name];
        return encodeURIComponent(text);
    });
    const method = route.method.toUpperCase();
    checkMatchedRoute(route, method, path, routes);
    const request: HubExtensionRequest = { method, path: extensionProxyPath(extensionId, path), query: [] };
    if (method === 'GET' || method === 'DELETE') {
        request.query = Object.entries(rest).flatMap(([key, value]) => toQueryValues(value).map((v): [string, string] => {
            if (!isQueryText(key) || !isQueryText(v)) {
                throw new Error(`Input property '${key}' ${QUERY_VALUE_RULE}, because it goes in the query`);
            }
            return [key, v];
        }));
    } else {
        request.body = rest;
    }
    return request;
}

/**
 * The route with the most literal segments wins in the proxy, so a value that equals a literal of another route,
 * such as `admin` for `/services/{name}` next to `/services/admin`, would call that route. MCP refuses it too.
 */
function checkMatchedRoute(route: HubExtensionRoute, method: string, path: string, routes: HubExtensionRoute[]): void {
    const parameters = pathParameterCount(route.path);
    const other = routes.find(r => r.id !== route.id && r.method.toUpperCase() === method
        && pathParameterCount(r.path) < parameters && matchesTemplate(r.path, path));
    if (other) {
        throw new Error(`The input fills the path ${route.path} so that it matches route '${other.id}', not route '${route.id}' of this command`);
    }
}

function pathParameterCount(template: string): number {
    return template.match(PATH_PARAM)?.length ?? 0;
}

// As ExtensionRouteMatcher in Hub: a {name} segment matches one segment that is not empty.
function matchesTemplate(template: string, path: string): boolean {
    const templateSegments = template.split('/');
    const pathSegments = path.split('/');
    return templateSegments.length === pathSegments.length && templateSegments.every((segment, i) =>
        /^\{.+\}$/.test(segment) ? pathSegments[i] !== '' : segment === pathSegments[i]);
}

const PATH_VALUE_RULE = 'must not be empty or ., or contain .., /, \\, %, @, a look-alike of /, \\, ., %, @ or ;, '
    + 'a control character or a lone surrogate';
const QUERY_VALUE_RULE = 'must not contain a control character or a lone surrogate';
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
// The lookAlikes of path-values.json: each code point whose NFKC form contains / or \, or is only ., %, @ or ;, and
// the visual look-alikes of / and \ that NFKC does not change.
const LOOK_ALIKE = /[;․-…⁄℀℁℅℆∕∖⧵⧸︔︙︰﹒﹔﹨﹪﹫％．／；＠＼]/;

// Hub refuses these parts of a path (ADR 0011), so a value with one would get a generic 400. A look-alike is refused
// because a backend that normalises Unicode can read it as the character, for example U+2025 as "..".
// encodeURIComponent throws on a lone surrogate.
function isPathValue(value: string): boolean {
    return value !== '' && value !== '.' && !LONE_SURROGATE.test(value) && !LOOK_ALIKE.test(value)
        // eslint-disable-next-line no-control-regex
        && !/\.\.|[/\\%@\u0000-\u001f\u007f]/.test(value);
}

// Hub refuses an encoded control character in a query. URLSearchParams would send a lone surrogate as U+FFFD.
function isQueryText(value: string): boolean {
    // eslint-disable-next-line no-control-regex
    return !LONE_SURROGATE.test(value) && !/[\u0000-\u001f\u007f]/.test(value);
}

function isScalar(value: unknown): value is string | number | boolean {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function scalarText(value: string | number | boolean): string {
    return typeof value === 'number' ? numberText(value) : String(value);
}

/**
 * A number in plain notation, with no exponent and no trailing zeros, as MCP writes it, so that both fill a
 * path or query with the same text: `1e21` gives `1000000000000000000000` and `1e-7` gives `0.0000001`.
 */
export function numberText(value: number): string {
    const text = String(value);
    const match = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(text);
    if (!match) return text;
    const [, sign, first, fraction = '', exponent] = match;
    const digits = first + fraction;
    const point = 1 + Number(exponent);
    if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`;
    if (point >= digits.length) return sign + digits + '0'.repeat(point - digits.length);
    return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

// An array repeats the key; an object or null is sent as JSON.
function toQueryValues(value: unknown): string[] {
    if (value === undefined) return [];
    if (Array.isArray(value)) return value.flatMap(toQueryValues);
    return [isScalar(value) ? scalarText(value) : JSON.stringify(value)];
}
