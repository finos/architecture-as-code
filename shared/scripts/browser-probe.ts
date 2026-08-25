// Bundled by check-browser-entry.mjs with fs/path stubbed to throw on touch. Exercises the real
// validate() path (JSON Schema + Spectral) through the browser entry with in-memory schemas.
import { validate, SchemaDirectory, buildBrowserDocumentLoader, formatOutput, browserSupportFor } from '../src/browser';
import calm from '../../calm/release/1.2/meta/calm.json';
import core from '../../calm/release/1.2/meta/core.json';
import iface from '../../calm/release/1.2/meta/interface.json';
import control from '../../calm/release/1.2/meta/control.json';
import controlRequirement from '../../calm/release/1.2/meta/control-requirement.json';
import evidence from '../../calm/release/1.2/meta/evidence.json';
import flow from '../../calm/release/1.2/meta/flow.json';
import units from '../../calm/release/1.2/meta/units.json';
import decorators from '../../calm/release/1.2/meta/decorators.json';
import timeline from '../../calm/release/1.2/meta/timeline.json';
import calmTimeline from '../../calm/release/1.2/meta/calm-timeline.json';

const documents: Record<string, object> = Object.fromEntries(
    [calm, core, iface, control, controlRequirement, evidence, flow, units, decorators, timeline, calmTimeline]
        .map((schema) => [(schema as { $id: string }).$id, schema])
);

const arch = (destination: string) => ({
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
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
console.log('browser probe ok: ' + bad.spectralSchemaValidationOutputs.length + ' spectral issue(s) on the broken document');
