// Bundled by check-browser-entry.mjs with fs/path stubbed to throw on touch. Exercises the real
// validate(), generate() and diffDocuments() paths through the browser entry with in-memory schemas.
import { validate, SchemaDirectory, buildBrowserDocumentLoader, formatOutput, browserSupportFor, generate, diffDocuments } from '../src/browser';

// Injected by check-browser-entry.mjs: the meta-schemas of every pinned release, keyed by $id, and
// the $id of the latest release's calm.json.
declare const __CALM_SCHEMAS__: Record<string, object>;
declare const __CALM_SCHEMA_ID__: string;
const documents = __CALM_SCHEMAS__;

const arch = (destination: string) => ({
    $schema: __CALM_SCHEMA_ID__,
    'unique-id': 'probe',
    nodes: [
        { 'unique-id': 'svc', 'node-type': 'service', name: 'Service', description: 'a service' },
        { 'unique-id': 'db', 'node-type': 'database', name: 'DB', description: 'a database' },
    ],
    relationships: [
        { 'unique-id': 'svc-db', 'relationship-type': { connects: { source: { node: 'svc' }, destination: { node: destination } } } },
    ],
});

async function directory(): Promise<SchemaDirectory> {
    const dir = new SchemaDirectory(buildBrowserDocumentLoader({ documents, allowRemote: false }));
    await dir.loadSchemas();
    return dir;
}

const good = await validate(arch('db'), undefined, undefined, await directory());
if (good.hasErrors) {
    throw new Error('probe: valid architecture reported errors:\n' + formatOutput(good, 'pretty'));
}
const bad = await validate(arch('ghost'), undefined, undefined, await directory());
if (!bad.hasErrors) {
    throw new Error('probe: dangling relationship was not reported');
}
if (browserSupportFor('docify')?.status !== 'unsupported') {
    throw new Error('probe: manifest missing docify');
}

const minimalPattern = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://x/p.json',
    type: 'object',
    properties: {
        nodes: { type: 'array', prefixItems: [] },
        relationships: { type: 'array', prefixItems: [] },
    },
};
const generated = await generate(minimalPattern, await directory()) as { nodes: unknown[] };
if (!Array.isArray(generated.nodes) || generated.nodes.length !== 0) {
    throw new Error('probe: generate did not produce the expected empty nodes array');
}

const diffResult = diffDocuments(arch('db'), { ...arch('db'), nodes: arch('db').nodes.slice(0, 1) });
if (diffResult.hasChanges !== true) {
    throw new Error('probe: diffDocuments did not report a change for the removed node');
}

console.log('browser probe ok: ' + bad.spectralSchemaValidationOutputs.length + ' spectral issue(s) on the broken document; generate and diff also ran');
