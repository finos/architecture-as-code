import { createServer } from 'http';
import { lookup } from 'dns/promises';
import * as fs from 'fs';
import path from 'path';

// A `*.localhost` name resolves to loopback (RFC 6761), but DirectUrlDocumentLoader rejects only the
// literal `localhost`. So this is a second origin that the CLI fetches through DirectUrlDocumentLoader,
// once it is in the allowlist. The fixture `$id`s and pattern consts hard-code
// http://smoke-controls.localhost:8090.
export const CROSS_HOST = 'smoke-controls.localhost';
const PORT = 8090;

export interface CrossHostOrigin {
    /** Request paths in arrival order; clear it with `requests.length = 0`. */
    requests: string[];
    close(): Promise<void>;
}

/** Serves each `*.json` file in `dir` at `/<file name>` on the cross-host origin. */
export async function serveCrossHostOrigin(dir: string): Promise<CrossHostOrigin> {
    const addresses = await lookup(CROSS_HOST, { all: true }).catch(() => []);
    if (!addresses.some(a => a.address === '127.0.0.1')) {
        throw new Error(`${CROSS_HOST} must resolve to 127.0.0.1 for the cross-host smoke tests (got ${JSON.stringify(addresses)})`);
    }

    const files = new Map(
        fs.readdirSync(dir)
            .filter(name => name.endsWith('.json'))
            .map(name => [`/${name}`, fs.readFileSync(path.join(dir, name))])
    );
    const requests: string[] = [];
    const server = createServer((req, res) => {
        const url = req.url ?? '';
        requests.push(url);
        const body = files.get(url);
        if (req.method !== 'GET' || !body) {
            res.writeHead(404).end();
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
    });
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(PORT, '127.0.0.1', () => resolve());
    });

    return {
        requests,
        close: () => new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve()))),
    };
}
