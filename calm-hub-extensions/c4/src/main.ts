import { createC4Server, exportExtension } from './server.js';

const env = process.env;
const port = Number(env.PORT ?? 8093);
const host = env.HOST ?? '127.0.0.1';
const hubUrl = env.CALM_HUB_URL ?? 'http://localhost:8080';
const issuer = env.CALM_HUB_ISSUER ?? hubUrl;

if (env.CALM_C4_EXPORT_DIR) {
    console.log(`copied the extension folder to ${await exportExtension(env.CALM_C4_EXPORT_DIR)}`);
}

createC4Server({
    hubUrl,
    issuer,
    account: {
        tokenUrl: env.CALM_HUB_TOKEN_URL,
        clientId: env.CALM_HUB_CLIENT_ID,
        clientSecret: env.CALM_HUB_CLIENT_SECRET,
        scope: env.CALM_HUB_SCOPE,
    },
    mappingHosts: (env.CALM_C4_MAPPING_HOSTS ?? '').split(',').map((entry) => entry.trim()).filter(Boolean),
}).listen(port, host, () => console.log(`C4 extension service on http://${host}:${port}, reading ${hubUrl}, trusting issuer ${issuer}`));
