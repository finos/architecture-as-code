import { readFile } from 'fs/promises';
import path from 'path';
import { CalmHubClient, type CalmHubOptions, type DocumentLoader } from '@finos/calm-shared';
import { resolveC4Mapping, type ResolvedC4Mapping } from '@finos/calm-models/c4';

export interface C4MappingSources {
    /** `--c4-mapping`: a file path or a URL. */
    flag?: string;
    /** `c4.mapping` from `.calm-workspace/config.json`, relative to `workspaceRoot`. */
    workspaceMapping?: string;
    workspaceRoot?: string;
    /** Reads the architecture. Its `$id` names its CALM Hub namespace when it came from CALM Hub. */
    readArchitecture: () => Promise<unknown>;
    hub?: CalmHubOptions;
}

export interface LoadedC4Mapping {
    mapping: ResolvedC4Mapping;
    /** Where the mapping came from, for the log. */
    from: string;
}

const HUB_ARCHITECTURE_ID = /^(https?:\/\/[^/]+)(?:\/api)?\/calm\/namespaces\/([^/]+)\/architectures\//;

function isUrl(reference: string): boolean {
    return /^https?:\/\//.test(reference);
}

/**
 * The C4 mapping for `calm docify`: `--c4-mapping`, else the workspace setting, else the namespace default of
 * the CALM Hub the architecture came from. Undefined when none is set, so the default mapping applies.
 */
export async function loadDocifyC4Mapping(sources: C4MappingSources, documentLoader: DocumentLoader): Promise<LoadedC4Mapping | undefined> {
    const load = async (reference: string, base: string) => {
        if (isUrl(reference)) return documentLoader.loadMissingDocument(reference, 'schema');
        return JSON.parse(await readFile(path.resolve(base, reference), 'utf8')) as unknown;
    };
    const resolve = (document: unknown, base: string) => resolveC4Mapping(document, (url) => load(url, base));

    if (sources.flag) {
        return { mapping: await resolve(await load(sources.flag, process.cwd()), process.cwd()), from: sources.flag };
    }
    if (sources.workspaceMapping && sources.workspaceRoot) {
        const root = sources.workspaceRoot;
        return { mapping: await resolve(await load(sources.workspaceMapping, root), root), from: `${sources.workspaceMapping} (workspace setting)` };
    }

    const hubUrl = sources.hub?.calmHubUrl;
    if (!hubUrl) return undefined;
    // docify reports an unreadable architecture itself.
    const architecture = await sources.readArchitecture().catch(() => undefined);
    const id = (architecture as { $id?: unknown } | null | undefined)?.$id;
    const match = typeof id === 'string' ? HUB_ARCHITECTURE_ID.exec(id) : null;
    if (!match || new URL(hubUrl).origin !== new URL(match[1]).origin) return undefined;
    const namespace = decodeURIComponent(match[2]);
    const found = await new CalmHubClient(sources.hub!).getNamespaceDefaultConfig(namespace, 'c4-mapping');
    if (!found) return undefined;
    return {
        mapping: await resolve(found.config, process.cwd()),
        from: `CALM Hub config ${found.configId} version ${found.version} of namespace ${found.namespace}`,
    };
}
