import { createServer } from 'http';
import * as fs from 'fs';
import path from 'path';

// A second origin that the CLI fetches through DirectUrlDocumentLoader, once it is in the allowlist.
// The loader refuses localhost and *.localhost names, so the CLI resolves this reserved `.test` name
// to 127.0.0.1 with a DNS shim. The fixture `$id`s and pattern consts hard-code
// http://smoke-controls.test:8090.
export const CROSS_HOST = 'smoke-controls.test';
const PORT = 8090;

/** Environment for a CLI run that fetches from the cross-host origin. */
export function crossHostEnv(): NodeJS.ProcessEnv {
    const shim = path.resolve(__dirname, 'resolve-cross-host.cjs');
    return {
        CALM_ALLOWED_REMOTE_HOSTS: CROSS_HOST,
        NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require ${JSON.stringify(shim)}`].filter(Boolean).join(' '),
    };
}

export interface CrossHostOrigin {
    /** Request paths in arrival order; clear it with `requests.length = 0`. */
    requests: string[];
    close(): Promise<void>;
}

/** Serves each `*.json` file in `dir` at `/<file name>` on the cross-host origin. */
export async function serveCrossHostOrigin(dir: string): Promise<CrossHostOrigin> {
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
