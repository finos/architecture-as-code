// A fixture backend for the example-services extension. It has no dependencies.
// It answers only requests that carry a valid CALM Hub identity assertion, and it never sees the user's token.
import { createServer } from 'node:http';
import { createVerifier } from './identity.mjs';

const PORT = Number(process.env.PORT ?? 8091);
const MAX_BODY_BYTES = 1024 * 1024;
const HUB_URL = process.env.CALM_HUB_URL ?? 'http://localhost:8080';
// The pause between the words of a chat reply. A question that contains "slow" waits longer, so you can try Stop.
const WORD_DELAY_MS = Number(process.env.CHAT_WORD_DELAY_MS ?? 60);
const ISSUER = process.env.CALM_HUB_ISSUER ?? HUB_URL;

// Made-up data: the services that each namespace owns, and the owner of each service.
const services = {
    finos: [
        { name: 'settlement-engine', owner: 'alice' },
        { name: 'settlement-reports', owner: 'alice' },
        { name: 'refunds-worker', owner: 'bob' },
    ],
};

const verifyAssertion = createVerifier({
    issuer: ISSUER,
    audience: 'example-services',
    fetchJwks: async () => {
        const res = await fetch(`${HUB_URL}/api/calm/auth/jwks`);
        if (!res.ok) throw new Error(`JWKS request failed with ${res.status}`);
        return res.json();
    },
});

function send(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

async function readBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) throw new Error('body too large');
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

// A cross-site form can send text/plain, but not JSON. CALM Hub refuses other types too.
function isJson(contentType = '') {
    const type = contentType.split(';')[0].trim().toLowerCase();
    return type === 'application/json' || (type.startsWith('application/') && type.endsWith('+json'));
}

// Hub checked the route's scope for the namespace in the path, and says so in ns. Hub sends ns only for
// a read, write or admin route, and dom only for a domain_* route. Each reply uses only sub and ns, so that it
// holds nothing that the user cannot read.
function handle(req, claims, url, body) {
    const json = () => (body.length ? JSON.parse(body.toString('utf8')) : {});
    const match = url.pathname.match(/^\/namespaces\/([^/]+)\/services$/);
    if (req.method === 'GET' && url.pathname === '/screen') {
        const mine = Object.values(services).flat().filter((s) => s.owner === claims.sub);
        return [200, { hubApi: 0, title: 'Services', blocks: [
            { type: 'markdown', text: `Hello **${claims.sub}**. You own ${mine.length} service(s).` },
            { type: 'table', columns: ['Service'], rows: mine.map((s) => [s.name]) },
        ] }];
    }
    if (match && claims.ns !== match[1]) return [403, { error: 'ns does not match the path' }];
    if (req.method === 'GET' && match) {
        return [200, { services: (services[claims.ns] ?? []).map((s) => s.name) }];
    }
    if (req.method === 'POST' && match) {
        const { name } = json();
        if (typeof name !== 'string' || !name) return [400, { error: 'name is required' }];
        (services[claims.ns] ??= []).push({ name, owner: claims.sub });
        return [201, { name }];
    }
    // The search provider. Its route is authenticated, so Hub checked no namespace: search only the caller's own
    // services. Hub also leaves out a result in a namespace that the caller cannot read. The cursor comes back
    // from the browser, so treat it as untrusted input.
    if (req.method === 'POST' && url.pathname === '/search') {
        const { query = '', limit = 10, cursor = '0' } = json();
        const start = /^\d{1,6}$/.test(cursor) ? Number(cursor) : 0;
        const hits = Object.entries(services).flatMap(([ns, list]) => list
            .filter((s) => s.owner === claims.sub && s.name.includes(String(query).toLowerCase()))
            .map((s) => ({ id: `${ns}/${s.name}`, title: s.name, summary: `A service that ${s.owner} owns`, namespace: ns,
                link: { screen: { extension: 'example-services', screen: 'services' } } })));
        const end = start + Math.min(Number(limit) || 10, 10);
        return [200, { hubApi: 0, results: hits.slice(start, end), ...(end < hits.length ? { next: String(end) } : {}) }];
    }
    return [404, { error: 'not found' }];
}

// A made-up chat: no model, so it shows the hubApi 0 chat contract and nothing else. It answers from the services
// that the caller owns and from the resource that the caller shared, if any. Hub checked the caller's read access
// to that resource and sent its document.
function chatReply(claims, request) {
    const question = request.messages.at(-1).content;
    const mine = Object.entries(services).flatMap(([ns, list]) =>
        list.filter((s) => s.owner === claims.sub).map((s) => ({ namespace: ns, name: s.name })));
    const words = [`You own ${mine.length} service(s)${mine.length ? `: ${mine.map((s) => s.name).join(', ')}` : ''}.`];
    const citations = [
        { label: 'Services screen', screen: { extension: 'example-services', screen: 'services' } },
        { label: 'CALM documentation', href: 'https://calm.finos.org/' },
    ];
    const { context } = request;
    if (context) {
        const nodes = Array.isArray(context.document?.nodes) ? context.document.nodes.length : 0;
        words.push(`You shared ${context.resourceType}/${context.resourceId} ${context.version} in ${context.namespace},`,
            `which has ${nodes} node(s)${context.selectedElement ? `, with ${context.selectedElement} selected` : ''}.`);
        citations.unshift({ label: `${context.resourceId} ${context.version}`,
            hub: { namespace: context.namespace, type: context.resourceType, id: context.resourceId, version: context.version } });
    } else {
        words.push('Share a resource with your question to ask about it.');
    }
    words.push(`You asked: "${question}". This example backend has no model, so it gives the same kind of answer each time.`);
    return { text: words.join(' ').split(/(?<= )/), citations, slow: /slow/i.test(question), fail: /fail/i.test(question) };
}

// Writes the reply as text/event-stream: delta events, then citation events, then done. Hub ends the stream for the
// caller when it closes, for example after Stop, and this backend then stops writing.
function streamChat(req, res, claims, body) {
    const request = JSON.parse(body.toString('utf8'));
    console.log(`POST /chat for ${claims.sub} (route ${claims.route}, jti ${claims.jti}, message ${request.messageId})`);
    const reply = chatReply(claims, request);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
    const event = (name, data) => res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
    const delay = reply.slow ? WORD_DELAY_MS * 10 : WORD_DELAY_MS;
    let index = 0;
    const timer = setInterval(() => {
        if (reply.fail && index === 3) {
            clearInterval(timer);
            // Ends the connection with no done event, as a backend that fails part way does.
            return res.destroy();
        }
        if (index < reply.text.length) return event('delta', { text: reply.text[index++] });
        clearInterval(timer);
        reply.citations.forEach((citation) => event('citation', citation));
        event('done', {});
        res.end();
        console.log(`chat ${request.messageId} for ${claims.sub} done after ${index} word(s)`);
    }, delay);
    res.on('close', () => {
        if (!res.writableFinished) console.log(`chat ${request.messageId} for ${claims.sub} stopped after ${index} word(s)`);
        clearInterval(timer);
    });
}

createServer(async (req, res) => {
    const url = new URL(req.url, 'http://backend');
    let body;
    try {
        body = await readBody(req);
    } catch (e) {
        return send(res, 413, { error: 'request body is too large' });
    }
    // A POST needs a JSON type also with no body: a cross-site form or a bodyless fetch can send one
    // with none. The other methods need a preflight, so for them only a body must be JSON.
    const needsJson = req.method === 'POST' || body.length > 0;
    if (needsJson && !isJson(req.headers['content-type'])) {
        return send(res, 415, { error: 'request must be JSON' });
    }
    let claims;
    try {
        // htp is relative to the backend URL. This backend is at the root of its URL, so htp is req.url.
        claims = await verifyAssertion(req.headers['x-calm-hub-identity'],
            { method: req.method, pathAndQuery: req.url, body });
    } catch (e) {
        console.warn(`rejected ${req.method} ${url.pathname}: ${e.message}`);
        return send(res, 401, { error: 'CALM Hub identity is missing or not valid' });
    }
    if (req.method === 'POST' && url.pathname === '/chat') {
        try {
            return streamChat(req, res, claims, body);
        } catch (e) {
            return send(res, 400, { error: 'bad request' });
        }
    }
    try {
        const [status, reply] = handle(req, claims, url, body);
        console.log(`${req.method} ${url.pathname} for ${claims.sub} (route ${claims.route}, jti ${claims.jti}): ${status}`);
        return send(res, status, reply);
    } catch (e) {
        return send(res, 400, { error: 'bad request' });
    }
}).listen(PORT, '127.0.0.1', () => console.log(`example-services backend on http://localhost:${PORT}, trusting ${HUB_URL}`));
