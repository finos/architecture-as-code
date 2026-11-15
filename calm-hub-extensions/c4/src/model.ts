import {
    defaultC4Mapping,
    projectC4,
    resolveC4Mapping,
    withDetailedArchitectures,
    type C4ArchitectureInput,
    type C4Model,
} from '@finos/calm-models/c4';
import { HubClient, Problem } from './hub.js';
import type { MappingSource } from './lens.js';

export interface ModelSource {
    hub: HubClient;
    /** The host names of CALM Hub: its public base URL and the URL that the service calls. */
    hubHosts: ReadonlySet<string>;
    /** Hosts outside CALM Hub that a mapping may `extends`, over https. */
    mappingHosts: ReadonlySet<string>;
}

const MAX_DETAILED_ARCHITECTURES = 50;
const HUB_ARCHITECTURE_PATH = /^\/calm\/namespaces\/([^/]+)\/architectures\/([^/]+)\/versions\/([^/]+)$/;
const HUB_CONVENTION_PATH = /^(?:\/api)?\/calm\/namespaces\/[^/]+\/conventions\/c4-mapping\/[^/]+\/versions\/[^/]+$/;

const segment = (value: string) => encodeURIComponent(value);

/** A numeric id is a Hub id. Any other id is a custom id, which the mapping API resolves. */
export function architecturePath(namespace: string, id: string, version: string): string {
    const rest = `${segment(namespace)}/architectures/${segment(id)}/versions/${segment(version)}`;
    return /^\d+$/.test(id) ? `/api/calm/namespaces/${rest}` : `/calm/namespaces/${rest}`;
}

/** The CALM Hub path of a `detailed-architecture` link, if it is an architecture in this namespace on this Hub. */
export function detailedArchitecturePath(link: string | undefined, namespace: string, hubHosts: ReadonlySet<string>): string | undefined {
    if (!link) return undefined;
    let path = link;
    if (/^https?:\/\//.test(link)) {
        const url = URL.parse(link);
        if (!url || !hubHosts.has(url.hostname)) return undefined;
        path = url.pathname;
    }
    const match = path.match(HUB_ARCHITECTURE_PATH);
    if (!match) return undefined;
    const [ns, id, version] = match.slice(1).map(decodeURIComponent);
    // The service account may read namespaces that the user cannot, so the lens follows links in this one only.
    return ns === namespace ? architecturePath(ns, id, version) : undefined;
}

interface NamespaceDefault {
    namespace: string;
    conventionId: number;
    version: string;
    inherited: boolean;
    convention: unknown;
}

async function namespaceMapping(source: ModelSource, namespace: string) {
    const found = (await source.hub.get(`/api/calm/namespaces/${segment(namespace)}/conventions/c4-mapping/default`)) as NamespaceDefault | undefined;
    if (!found) {
        const mapping = defaultC4Mapping();
        return { mapping, source: { id: mapping['unique-id'] } satisfies MappingSource };
    }
    const load = async (url: string) => {
        const parsed = URL.parse(url, source.hub.baseUrl);
        if (parsed && source.hubHosts.has(parsed.hostname) && HUB_CONVENTION_PATH.test(parsed.pathname)) {
            const value = await source.hub.get(parsed.pathname.startsWith('/api/') ? parsed.pathname : `/api${parsed.pathname}`);
            if (value === undefined) throw new Error(`CALM Hub has no C4 mapping at ${url}`);
            return value;
        }
        // Any other URL could reach an internal service, so the operator names the hosts that a mapping may use.
        if (parsed?.protocol !== 'https:' || !source.mappingHosts.has(parsed.hostname)) {
            throw new Error(`The C4 service may not fetch ${url}. The operator can add its host to CALM_C4_MAPPING_HOSTS.`);
        }
        const res = await fetch(parsed, { signal: AbortSignal.timeout(5_000), redirect: 'error' });
        if (!res.ok) throw new Error(`${url} returned ${res.status}`);
        return res.json();
    };
    try {
        const mapping = await resolveC4Mapping(found.convention, load);
        const { namespace: from, conventionId, version, inherited } = found;
        return { mapping, source: { id: mapping['unique-id'], namespace: from, conventionId, version, inherited } satisfies MappingSource };
    } catch (error) {
        throw new Problem(422, 'The C4 mapping of the namespace does not load', (error as Error).message);
    }
}

/**
 * The C4 model of an architecture version: the architecture with its detailed architectures in the same namespace
 * (rule 5 of the C4 standard), projected with the C4 mapping of the namespace.
 */
export async function loadC4Model(source: ModelSource, namespace: string, id: string, version: string): Promise<{ model: C4Model; mapping: MappingSource; calmIds: Set<string> }> {
    const [architecture, resolved] = await Promise.all([
        source.hub.get(architecturePath(namespace, id, version)) as Promise<C4ArchitectureInput | undefined>,
        namespaceMapping(source, namespace),
    ]);
    if (!architecture) throw new Problem(404, 'CALM Hub has no such architecture', `${namespace}/${id} version ${version}`);
    const links = (architecture.nodes ?? [])
        .map((node) => [node['unique-id'], detailedArchitecturePath(node.details?.['detailed-architecture'], namespace, source.hubHosts)] as const)
        .filter((entry): entry is readonly [string, string] => entry[1] !== undefined)
        .slice(0, MAX_DETAILED_ARCHITECTURES);
    // A link that does not load is left out, so the node shows without its detail.
    const details = await Promise.all(links.map(([node, path]) => source.hub.get(path).then((value) => [node, value] as const, () => [node, undefined] as const)));
    const expanded = withDetailedArchitectures(architecture, Object.fromEntries(details.filter(([, value]) => value)) as Record<string, C4ArchitectureInput>);
    const model = projectC4(expanded, resolved.mapping, { namespace, architectureName: /^\d+$/.test(id) ? undefined : id });
    // A node of a detailed architecture is not a node of this one, so the lens cannot select it.
    return { model, mapping: resolved.source, calmIds: new Set((architecture.nodes ?? []).map((node) => node['unique-id'])) };
}
