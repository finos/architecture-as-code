// Starts a demo backend as a child process, with a fake Hub that serves the JWKS, and sends
// requests that carry a signed identity assertion.
import { spawn } from 'node:child_process';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';

const ISSUER = 'http://hub.test';

async function freePort() {
    const server = createServer().listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address();
    server.close();
    return port;
}

export async function startBackend(serverUrl, audience) {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwks = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'test', alg: 'RS256', use: 'sig' }] };
    const hub = createServer((req, res) => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(jwks)))
        .listen(0, '127.0.0.1');
    await once(hub, 'listening');

    const port = await freePort();
    const child = spawn(process.execPath, [new URL(serverUrl).pathname], {
        env: { ...process.env, PORT: String(port), CALM_HUB_URL: `http://127.0.0.1:${hub.address().port}`, CALM_HUB_ISSUER: ISSUER },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    await new Promise((resolve, reject) => {
        child.stdout.on('data', (chunk) => {
            output += chunk;
            if (output.includes('backend on')) resolve();
        });
        child.on('exit', (code) => reject(new Error(`backend exited with ${code}`)));
    });

    function assertion(method, pathAndQuery, body) {
        const now = Math.floor(Date.now() / 1000);
        const header = { alg: 'RS256', typ: 'calm-ext+jwt', kid: 'test' };
        const bdh = body ? createHash('sha256').update(body).digest('base64url') : undefined;
        const claims = { iss: ISSUER, sub: 'alice', aud: audience, iat: now, exp: now + 60, jti: randomUUID(),
            htm: method, htp: pathAndQuery, bdh };
        const input = [header, claims].map((part) => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.');
        return `${input}.${sign('sha256', Buffer.from(input), privateKey).toString('base64url')}`;
    }

    return {
        // A header set to undefined is not sent. A Buffer body gets no Content-Type from fetch.
        request: (method, path, body, headers = {}) => fetch(`http://127.0.0.1:${port}${path}`, {
            method,
            headers: Object.fromEntries(Object.entries({
                'X-Calm-Hub-Identity': assertion(method, path, body), 'Content-Type': 'application/json', ...headers,
            }).filter(([, value]) => value !== undefined)),
            body,
        }),
        stop: () => {
            child.kill();
            hub.close();
        },
    };
}
