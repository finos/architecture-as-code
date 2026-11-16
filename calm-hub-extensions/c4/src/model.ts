import {
    defaultC4Mapping,
    projectC4,
    resolveC4Mapping,
    withDetailedArchitectures,
    type C4ArchitectureInput,
    type C4Model,
} from '@finos/calm-models/c4';
import { hasArchitectureShape, Problem } from './problem.js';
import type { MappingSource } from './lens.js';

/**
 * The body that CALM Hub sends to the lens route, from the `hubData` of the route. Hub read it with the scope of the
 * user, so the service needs no account and no route back to Hub.
 */
export interface HubData {
    document?: C4ArchitectureInput;
    /** The CALM Hub resources that the document or a convention links to, keyed by the link as written. */
    linked?: Record<string, unknown>;
    conventions?: {
        'c4-mapping'?: { namespace: string; conventionId: number; version: string; inherited: boolean; convention: unknown };
    };
}

const MAX_MAPPING_FETCHES = 8;
const MAX_MAPPING_BYTES = 1024 * 1024;

/** The body of a response, read up to `max` bytes. The read stops, and the download is cancelled, at the cap. */
async function boundedText(res: Response, url: string, max: number): Promise<string> {
    const reader = res.body?.getReader();
    if (!reader) return '';
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) {
            await reader.cancel();
            throw new Error(`${url} is larger than ${max} bytes`);
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
}

async function namespaceMapping(data: HubData, mappingHosts: ReadonlySet<string>) {
    const found = data.conventions?.['c4-mapping'];
    if (!found) {
        const mapping = defaultC4Mapping();
        return { mapping, source: { id: mapping['unique-id'] } satisfies MappingSource };
    }
    let fetches = 0;
    const load = async (url: string) => {
        // Hub sent each mapping on Hub that the chain extends, and that the user can read.
        if (data.linked && Object.hasOwn(data.linked, url)) return data.linked[url];
        // Any other URL could reach an internal service, so the operator names the hosts that a mapping may use.
        const parsed = URL.parse(url);
        if (parsed?.protocol !== 'https:' || parsed.port !== '' || !mappingHosts.has(parsed.hostname)) {
            throw new Error(`The C4 service may not fetch ${url}. The operator can add its host to CALM_C4_MAPPING_HOSTS.`);
        }
        if (++fetches > MAX_MAPPING_FETCHES) throw new Error(`The mapping extends more than ${MAX_MAPPING_FETCHES} mappings outside CALM Hub`);
        const res = await fetch(parsed, { signal: AbortSignal.timeout(5_000), redirect: 'error' });
        if (!res.ok) throw new Error(`${url} returned ${res.status}`);
        return JSON.parse(await boundedText(res, url, MAX_MAPPING_BYTES));
    };
    try {
        const mapping = await resolveC4Mapping(found.convention, load);
        const { namespace, conventionId, version, inherited } = found;
        return { mapping, source: { id: mapping['unique-id'], namespace, conventionId, version, inherited } satisfies MappingSource };
    } catch (error) {
        throw new Problem(422, 'The C4 mapping of the namespace does not load', (error as Error).message);
    }
}

/**
 * The C4 model of the architecture that Hub sent: with the detailed architectures that Hub sent (rule 5 of the C4
 * standard), projected with the C4 mapping of the namespace.
 */
export async function buildC4Model(data: HubData, namespace: string, id: string, mappingHosts: ReadonlySet<string> = new Set()):
    Promise<{ model: C4Model; mapping: MappingSource; calmIds: Set<string> }> {
    const architecture = data.document;
    if (!architecture || typeof architecture !== 'object') {
        throw new Problem(400, 'CALM Hub sent no architecture', 'The lens route of the manifest needs "hubData": ["document", …]');
    }
    if (!hasArchitectureShape(architecture)) {
        throw new Problem(400, 'The architecture is not valid CALM', 'Each node needs a unique-id and a node-type, and each relationship a unique-id and a relationship-type');
    }
    const resolved = await namespaceMapping(data, mappingHosts);
    const details = Object.fromEntries((architecture.nodes ?? []).flatMap((node) => {
        const link = node.details?.['detailed-architecture'];
        const child = link && data.linked && Object.hasOwn(data.linked, link) ? data.linked[link] : undefined;
        return hasArchitectureShape(child) ? [[node['unique-id'], child as C4ArchitectureInput]] : [];
    }));
    const expanded = withDetailedArchitectures(architecture, details);
    const model = projectC4(expanded, resolved.mapping, { namespace, architectureName: /^\d+$/.test(id) ? undefined : id });
    // A node of a detailed architecture is not a node of this one, so the lens cannot select it.
    return { model, mapping: resolved.source, calmIds: new Set((architecture.nodes ?? []).map((node) => node['unique-id'])) };
}
