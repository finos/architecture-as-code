import { copyFile, mkdir } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVerifier, type Claims, type Jwks } from './identity.js';
import { HubClient, Problem, type ServiceAccount } from './hub.js';
import { layersLensReply, parseView, type CalmArchitecture } from './lens.js';

/** The manifest id. Hub names the extension folder after it, and puts it in the `aud` of each assertion. */
export const EXTENSION_ID = 'ea-layers';
/** The files that Hub reads from the extension folder. */
export const EXTENSION_FILES = ['extension.json', 'notation.json'];

export interface LayersServiceConfig {
    /** Where the service calls CALM Hub, such as http://hub:8080 in a compose project. */
    hubUrl: string;
    /** The `calm.hub.base-url` of Hub, which it signs as `iss`. */
    issuer: string;
    account?: ServiceAccount;
}

const LENS_PATH = /^\/lens\/([^/]+)\/([^/]+)\/([^/]+)$/;

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json') {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'private, no-store' });
    res.end(JSON.stringify(body));
}

function sendProblem(res: ServerResponse, problem: Problem) {
    send(res, problem.status, { type: 'about:blank', title: problem.title, status: problem.status, ...(problem.detail && { detail: problem.detail }) },
        'application/problem+json');
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
}

/** A numeric id is a Hub id. Any other id is a custom id, which the mapping API resolves. */
export function architecturePath(namespace: string, id: string, version: string): string {
    const rest = [namespace, 'architectures', id, 'versions', version].map(encodeURIComponent).join('/');
    return /^\d+$/.test(id) ? `/api/calm/namespaces/${rest}` : `/calm/namespaces/${rest}`;
}

export function createLayersHandler(config: LayersServiceConfig) {
    const hub = new HubClient(config.hubUrl, config.account);
    const verifyAssertion = createVerifier({
        issuer: config.issuer,
        audience: EXTENSION_ID,
        fetchJwks: async () => {
            const res = await fetch(new URL('/api/calm/auth/jwks', config.hubUrl), { signal: AbortSignal.timeout(5_000) });
            if (!res.ok) throw new Error(`JWKS request failed with ${res.status}`);
            return (await res.json()) as Jwks;
        },
    });

    async function lens(claims: Claims, url: URL, [namespace, resourceType, resourceId]: string[]) {
        // Hub checked the read scope for the namespace in the path, and says so in ns.
        if (claims.ns !== namespace) throw new Problem(403, 'The identity assertion is for another namespace');
        if (resourceType !== 'architectures') throw new Problem(404, 'The layers lens shows architectures only');
        const version = url.searchParams.get('version');
        if (!version) throw new Problem(400, 'The layers lens needs the version of the architecture');
        const architecture = (await hub.get(architecturePath(namespace, resourceId, version))) as CalmArchitecture | undefined;
        if (!architecture) throw new Problem(404, 'CALM Hub has no such architecture', `${namespace}/${resourceId} version ${version}`);
        return layersLensReply(architecture, parseView(url.searchParams.get('view')));
    }

    return async function handle(req: IncomingMessage, res: ServerResponse) {
        const url = new URL(req.url ?? '/', 'http://backend');
        if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { status: 'ok' });
        const body = await readBody(req);
        let claims: Claims;
        try {
            // htp is relative to the backend URL. This service is at the root of its URL, so htp is req.url.
            claims = await verifyAssertion(req.headers['x-calm-hub-identity'] as string | undefined, { method: req.method ?? '', pathAndQuery: req.url ?? '', body });
        } catch (error) {
            console.warn(`rejected ${req.method} ${url.pathname}: ${(error as Error).message}`);
            return sendProblem(res, new Problem(401, 'CALM Hub identity is missing or not valid'));
        }
        const match = req.method === 'GET' ? url.pathname.match(LENS_PATH) : null;
        try {
            if (!match) throw new Problem(404, 'Not found');
            const reply = await lens(claims, url, match.slice(1).map(decodeURIComponent));
            console.log(`GET ${url.pathname}${url.search} for ${claims.sub}: ${reply.graph.nodes.length} nodes`);
            return send(res, 200, reply);
        } catch (error) {
            const problem = error instanceof Problem ? error : new Problem(502, 'The layers service failed', (error as Error).message);
            console.warn(`${req.method} ${url.pathname}${url.search} for ${claims.sub}: ${problem.status} ${problem.message}`);
            return sendProblem(res, problem);
        }
    };
}

export function createLayersServer(config: LayersServiceConfig) {
    return createServer(createLayersHandler(config));
}

/** The folder of the service, which holds extension.json and notation.json, next to dist/. */
export const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));

/**
 * Copies the extension folder into `<dir>/ea-layers`, for a Hub that reads `calm.extensions.dir` from a shared volume.
 * The copy runs at each start, so a new image replaces the files of the last one.
 */
export async function exportExtension(dir: string, from = PACKAGE_DIR) {
    const target = join(dir, EXTENSION_ID);
    await mkdir(target, { recursive: true });
    await Promise.all(EXTENSION_FILES.map((file) => copyFile(join(from, file), join(target, file))));
    return target;
}
