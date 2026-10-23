// A minimal CALM Hub extension. It has no dependencies.
// It accepts a request only when CALM Hub signed the caller's identity, and it never sees the user's token.
import { createServer } from 'node:http';
import { createPublicKey, verify } from 'node:crypto';
import { directory } from './directory.mjs';

const PORT = Number(process.env.PORT ?? 8091);
const HUB_URL = process.env.CALM_HUB_URL ?? 'http://localhost:8090';
const EXTENSION_ID = 'team-services';
const ISSUER = process.env.CALM_HUB_ISSUER ?? 'calm-hub';

let keys = new Map();

async function loadKeys() {
    const res = await fetch(`${HUB_URL}/api/calm/auth/jwks`);
    if (!res.ok) throw new Error(`JWKS request failed with ${res.status}`);
    const { keys: jwks } = await res.json();
    keys = new Map(jwks.map((jwk) => [jwk.kid, createPublicKey({ key: jwk, format: 'jwk' })]));
}

function decode(part) {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

// Returns the verified claims, or throws.
async function verifyIdentity(token) {
    const parts = token?.split('.');
    if (parts?.length !== 3) throw new Error('not a JWT');
    const [h, p, s] = parts;
    const header = decode(h);
    if (header.alg !== 'RS256') throw new Error(`unexpected alg ${header.alg}`);
    if (!keys.has(header.kid)) await loadKeys();
    const key = keys.get(header.kid);
    if (!key) throw new Error('unknown key id');
    if (!verify('sha256', Buffer.from(`${h}.${p}`), key, Buffer.from(s, 'base64url'))) throw new Error('bad signature');
    const claims = decode(p);
    const now = Math.floor(Date.now() / 1000);
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== ISSUER) throw new Error('wrong issuer');
    if (!audience.includes(EXTENSION_ID)) throw new Error('wrong audience');
    if (typeof claims.exp !== 'number' || claims.exp < now) throw new Error('expired');
    return claims;
}

function send(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

function screenFor(username) {
    const person = directory.people[username];
    if (!person) {
        return {
            hubApi: 0,
            title: 'Team services',
            blocks: [
                { type: 'markdown', text: `Hello **${username}**. You are not in a team in the service directory.` },
                { type: 'alert', tone: 'info', text: 'Ask Platform Engineering to add you to a team.' },
            ],
        };
    }
    const team = directory.teams[person.team];
    const services = team.services;
    const withArchitecture = services.filter((s) => s.architecture);
    const missing = services.filter((s) => !s.architecture);
    const incidents = services.filter((s) => s.status === 'Incident').length;
    const hubLink = (a) => ({ label: `${a.id} ${a.version}`, hub: { namespace: a.namespace, type: 'architectures', id: a.id, version: a.version } });

    return {
        hubApi: 0,
        title: 'Team services',
        blocks: [
            { type: 'markdown', text: `Hello **${person.name}**. You are ${/^[aeiou]/i.test(person.role) ? 'an' : 'a'} ${person.role.toLowerCase()} in **${person.team}**. These are the services that your team owns.` },
            {
                type: 'keyValue',
                items: [
                    { label: 'Team', value: person.team },
                    { label: 'Your role', value: person.role },
                    { label: 'On call', value: team.onCall },
                ],
            },
            {
                type: 'stats',
                items: [
                    { label: 'Services', value: services.length },
                    { label: 'Open incidents', value: incidents },
                    { label: 'Architectures in Hub', value: withArchitecture.length },
                ],
            },
            {
                type: 'table',
                columns: ['Service', 'Status', 'Architecture in Hub', 'Owner'],
                rows: services.map((s) => [
                    s.name,
                    { badge: s.status, tone: s.status === 'Healthy' ? 'positive' : 'negative' },
                    s.architecture ? hubLink(s.architecture) : 'None',
                    s.owner,
                ]),
            },
            {
                type: 'cards',
                items: withArchitecture.map((s) => ({
                    title: s.architecture.id,
                    subtitle: `Architecture · ${s.architecture.version}`,
                    link: { ...hubLink(s.architecture), label: 'Open in Hub' },
                })),
            },
            ...missing.map((s) => ({ type: 'alert', tone: 'warning', text: `${s.name} has no architecture in CALM Hub.` })),
            {
                type: 'links',
                items: [
                    { label: 'Open runbook', href: team.runbook },
                    { label: 'Team page', href: team.page },
                ],
            },
        ],
    };
}

createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method !== 'GET' || url.pathname !== '/screen') {
        return send(res, 404, { error: 'not found' });
    }
    try {
        const claims = await verifyIdentity(req.headers['x-calm-hub-identity']);
        console.log(`screen for ${claims.sub}`);
        return send(res, 200, screenFor(claims.sub));
    } catch (e) {
        console.warn(`rejected request: ${e.message}`);
        return send(res, 401, { error: 'CALM Hub identity is missing or not valid' });
    }
}).listen(PORT, '127.0.0.1', () => console.log(`team-services extension on http://localhost:${PORT}, trusting ${HUB_URL}`));
