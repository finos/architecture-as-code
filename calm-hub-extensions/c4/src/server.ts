import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTenantVerifier, type Claims, type Tenant } from './identity.js';
import { c4LensReply, parseLensLevel } from './lens.js';
import { buildC4Model, type HubData } from './model.js';
import { Problem } from './problem.js';

/** The manifest id. Hub names the extension folder after it, and puts it in the `aud` of each assertion. */
export const EXTENSION_ID = 'c4';
/** The files that Hub reads from the extension folder. */
export const EXTENSION_FILES = ['extension.json', 'notation.json'];
/** Larger than the default max-request-bytes of Hub (1 MiB), so an operator can raise that a little. */
export const MAX_BODY_BYTES = 4 * 1024 * 1024;

export interface C4ServiceConfig {
    /**
     * The CALM Hubs that may call the service, or `open` for any caller. The service keeps no data and draws only the
     * body that it gets, so a service that does not charge or limit its callers can be open.
     */
    tenants: Tenant[] | 'open';
    mappingHosts?: string[];
}

const LENS_PATH = /^\/lens\/([^/]+)\/([^/]+)\/([^/]+)$/;
const EXTENSION_FILE_PATH = /^\/extension\/([a-z.]+)$/;

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
    let size = 0;
    for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > MAX_BODY_BYTES) throw new Problem(413, 'The request is too large for the C4 service');
        chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
}

function decodePathSegment(segment: string) {
    try {
        return decodeURIComponent(segment);
    } catch {
        throw new Problem(400, 'The path has an escape that is not valid');
    }
}

/** The folder of the service, which holds extension.json and notation.json, next to dist/. */
export const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));

export function createC4Handler(config: C4ServiceConfig, packageDir = PACKAGE_DIR) {
    const mappingHosts = new Set(config.mappingHosts ?? []);
    const verifyAssertion = config.tenants === 'open' ? undefined : createTenantVerifier(config.tenants, EXTENSION_ID);

    async function lens(claims: Claims | undefined, url: URL, [namespace, resourceType, resourceId]: string[], body: Buffer) {
        // Hub checked the read scope for the namespace in the path, and says so in ns.
        if (claims && claims.ns !== namespace) throw new Problem(403, 'The identity assertion is for another namespace');
        if (resourceType !== 'architectures') throw new Problem(404, 'The C4 lens shows architectures only');
        let data: HubData;
        try {
            data = JSON.parse(body.toString('utf8')) as HubData;
        } catch {
            throw new Problem(400, 'The body from CALM Hub is not JSON');
        }
        const { model, mapping, calmIds } = await buildC4Model(data ?? {}, namespace, resourceId, mappingHosts);
        return c4LensReply(model, parseLensLevel(url.searchParams.get('level')), url.searchParams.get('scope'), mapping, calmIds);
    }

    async function handle(req: IncomingMessage, res: ServerResponse) {
        // A direct caller can send any request target, such as //[, which is not a URL.
        const url = URL.parse(req.url ?? '/', 'http://backend');
        if (!url) return sendProblem(res, new Problem(400, 'The request target is not valid'));
        if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { status: 'ok' });
        // The extension folder, for an operator who installs the extension on a Hub that calls a hosted service.
        const file = req.method === 'GET' ? url.pathname.match(EXTENSION_FILE_PATH)?.[1] : undefined;
        if (file && EXTENSION_FILES.includes(file)) {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' });
            return res.end(await readFile(join(packageDir, file)));
        }
        let body: Buffer;
        let claims: Claims | undefined;
        try {
            body = await readBody(req);
            // htp is relative to the backend URL. This service is at the root of its URL, so htp is req.url.
            claims = await verifyAssertion?.(req.headers['x-calm-hub-identity'] as string | undefined, { method: req.method ?? '', pathAndQuery: req.url ?? '', body });
        } catch (error) {
            if (error instanceof Problem) return sendProblem(res, error);
            console.warn(`rejected ${req.method} ${url.pathname}: ${(error as Error).message}`);
            return sendProblem(res, new Problem(401, 'CALM Hub identity is missing or not valid'));
        }
        const caller = claims ? `${claims.sub} of ${claims.iss}` : 'an open caller';
        const match = req.method === 'POST' ? url.pathname.match(LENS_PATH) : null;
        try {
            if (!match) throw new Problem(404, 'Not found');
            const reply = await lens(claims, url, match.slice(1).map(decodePathSegment), body);
            console.log(`POST ${url.pathname}${url.search} for ${caller}: ${reply.graph.nodes.length} nodes`);
            return send(res, 200, reply);
        } catch (error) {
            const problem = error instanceof Problem ? error : new Problem(502, 'The C4 service failed', (error as Error).message);
            console.warn(`${req.method} ${url.pathname}${url.search} for ${caller}: ${problem.status} ${problem.message}`);
            return sendProblem(res, problem);
        }
    }

    // A failure that escapes handle must not end the process: Node does not catch a rejected request listener.
    return (req: IncomingMessage, res: ServerResponse) => {
        handle(req, res).catch((error: unknown) => {
            console.error(`${req.method} ${req.url}: ${(error as Error).message}`);
            if (!res.headersSent) sendProblem(res, new Problem(500, 'The service failed'));
            else res.destroy();
        });
    };
}

export function createC4Server(config: C4ServiceConfig) {
    return createServer(createC4Handler(config));
}

/**
 * Copies the extension folder into `<dir>/c4`, for a Hub that reads `calm.extensions.dir` from a shared volume.
 * The copy runs at each start, so a new image replaces the files of the last one.
 */
export async function exportExtension(dir: string, from = PACKAGE_DIR) {
    const target = join(dir, EXTENSION_ID);
    await mkdir(target, { recursive: true });
    await Promise.all(EXTENSION_FILES.map((file) => copyFile(join(from, file), join(target, file))));
    return target;
}
