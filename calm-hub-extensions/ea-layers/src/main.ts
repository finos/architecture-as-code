import { readFileSync } from 'node:fs';
import { parseTenants, type Tenant } from './identity.js';
import { createLayersServer, exportExtension } from './server.js';

const env = process.env;
const port = Number(env.PORT ?? 8094);
const host = env.HOST ?? '127.0.0.1';

// A sidecar trusts its own Hub. A hosted service reads the Hubs that it trusts from a file, or is open to any caller.
function tenants(): Tenant[] | 'open' {
    if (env.CALM_OPEN_ACCESS === 'true') {
        if (env.CALM_HUB_TENANTS_FILE) throw new Error('set CALM_OPEN_ACCESS or CALM_HUB_TENANTS_FILE, not both');
        return 'open';
    }
    if (env.CALM_HUB_TENANTS_FILE) return parseTenants(readFileSync(env.CALM_HUB_TENANTS_FILE, 'utf8'));
    const hubUrl = env.CALM_HUB_URL ?? 'http://localhost:8080';
    return [{ issuer: env.CALM_HUB_ISSUER ?? hubUrl, jwksUrl: new URL('/api/calm/auth/jwks', hubUrl).href }];
}

if (env.CALM_EA_LAYERS_EXPORT_DIR) {
    console.log(`copied the extension folder to ${await exportExtension(env.CALM_EA_LAYERS_EXPORT_DIR)}`);
}

const trusted = tenants();
createLayersServer({
    tenants: trusted,
}).listen(port, host, () => console.log(`Layers extension service on http://${host}:${port}, trusting ${trusted === 'open' ? 'any caller' : trusted.map((t) => t.issuer).join(', ')}`));
