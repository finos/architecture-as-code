// Demo backend for the release-tracker extension. It answers only requests that carry a valid
// CALM Hub identity assertion, and returns Hub "blocks" for each contribution.
import { createServer } from 'node:http';
import { createVerifier } from '../../extensions/example-services/identity.mjs';
import { route } from './routes.mjs';

const PORT = Number(process.env.PORT ?? 8092);
const HUB_URL = process.env.CALM_HUB_URL ?? 'http://localhost:8080';
// Hub signs `iss` with calm.hub.base-url, whatever address the JWKS comes from.
const ISSUER = process.env.CALM_HUB_ISSUER ?? 'http://localhost:8080';

const verifyAssertion = createVerifier({
    issuer: ISSUER,
    audience: 'release-tracker',
    fetchJwks: async () => {
        const res = await fetch(`${HUB_URL}/api/calm/auth/jwks`);
        if (!res.ok) throw new Error(`JWKS request failed with ${res.status}`);
        return res.json();
    },
});

createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const text = Buffer.concat(chunks);
    let claims;
    try {
        // The bdh claim binds the body, so read it before the check.
        claims = await verifyAssertion(req.headers['x-calm-hub-identity'],
            { method: req.method, pathAndQuery: req.url, body: text });
    } catch (e) {
        console.warn(`rejected ${req.method} ${url.pathname}: ${e.message}`);
        res.writeHead(401).end();
        return;
    }
    let body = {};
    try {
        if (text.length) body = JSON.parse(text.toString('utf8'));
    } catch {
        console.warn(`rejected ${req.method} ${url.pathname}: the body is not valid JSON`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'the body is not valid JSON' }));
        return;
    }
    const reply = route(req.method, url, body);
    console.log(`${req.method} ${url.pathname}${url.search} for ${claims.sub}: ${reply ? 200 : 404}`);
    res.writeHead(reply ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(reply ?? { error: 'not found' }));
}).listen(PORT, '127.0.0.1', () => console.log(`release-tracker backend on http://localhost:${PORT}, trusting issuer ${ISSUER}`));
