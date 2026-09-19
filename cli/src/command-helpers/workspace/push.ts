import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import {
    loadManifest,
    saveManifest,
    resolveFilePath,
    type NarrativeCreateRecovery,
    type NarrativeWorkspaceManifestEntry,
    type PublishedNarrativeWorkspaceManifestEntry,
    type MappingWorkspaceManifestEntry,
    type WorkspaceManifest,
} from './bundle';
import {
    CalmHubClient,
    DocumentMetadata,
    HubClientError,
    extractDocumentMetadata,
    initLogger,
    Logger,
} from '@finos/calm-shared';
import { canonicalEqual } from './bump';
import {
    parseNarrativeDocumentLocation,
    resolveNarrativeEntry,
    validateNarrativeDocumentLocation,
} from './narrative-document';
import {
    dispatchWorkspaceManifestEntry,
    resolveWorkspaceManifestEntry,
    type WorkspaceManifestEntryOperations,
} from './document-kind';

const logger: Logger = initLogger(false, 'workspace');
const DEFINITE_CREATE_REJECTION_STATUSES = new Set([400, 401, 403, 404]);

export interface PushOptions {
    /**
     * What to do when the version a document declares already exists in CalmHub.
     *  - `false` (default): skip it (idempotent local pushes).
     *  - `true`: if the on-disk content *differs* from the published version, report the conflict
     *    and fail the push once all entries are processed (strict merge-time CI). An existing
     *    version whose content is unchanged is still skipped.
     */
    failIfModified?: boolean;
}

interface PushEntryContext {
    bundlePath: string;
    client: CalmHubClient;
    conflicts: string[];
    failIfModified: boolean;
    id: string;
    manifest: WorkspaceManifest;
    mappingFailures: string[];
    narrativeFailures: string[];
    raw: string;
}

const PUSH_ENTRY_OPERATIONS = {
    mapping: pushMappingEntry,
    narrative: pushNarrativeEntry,
} satisfies WorkspaceManifestEntryOperations<Promise<void>, [PushEntryContext]>;

export async function pushWorkspaceToHub(
    bundlePath: string,
    client: CalmHubClient,
    options: PushOptions = {}
): Promise<void> {
    const failIfModified = options.failIfModified ?? false;
    const manifest = await loadManifest(bundlePath);
    const entries = Object.entries(manifest);

    if (entries.length === 0) {
        logger.warn('No files in workspace manifest to push.');
        return;
    }

    const conflicts: string[] = [];
    const mappingFailures: string[] = [];
    const narrativeFailures: string[] = [];

    for (const [id, entry] of entries) {
        const document = resolveWorkspaceManifestEntry(entry);
        const filePath = resolveFilePath(bundlePath, entry.path);

        if (!existsSync(filePath)) {
            logger.warn(`File not found for id '${id}': ${filePath}`);
            if (document.handler.unreadableFile === 'fail') narrativeFailures.push(`${id}: file not found`);
            continue;
        }

        let raw: string;
        try {
            raw = await readFile(filePath, 'utf8');
        } catch (e) {
            logger.warn(`Failed to read file for id '${id}': ${e instanceof Error ? e.message : String(e)}`);
            if (document.handler.unreadableFile === 'fail') narrativeFailures.push(`${id}: file could not be read`);
            continue;
        }

        await dispatchWorkspaceManifestEntry(document, PUSH_ENTRY_OPERATIONS, {
            bundlePath,
            client,
            conflicts,
            failIfModified,
            id,
            manifest,
            mappingFailures,
            narrativeFailures,
            raw,
        });
    }

    if (conflicts.length > 0 || mappingFailures.length > 0 || narrativeFailures.length > 0) {
        const summaries: string[] = [];
        if (conflicts.length > 0) {
            summaries.push(
                `${conflicts.length} modified document(s) already exist in CalmHub at their declared version ` +
                `(${conflicts.join(', ')}). Run \`calm workspace bump\` to create new versions for them.`
            );
        }
        if (mappingFailures.length > 0) {
            summaries.push(`${mappingFailures.length} mapping document(s) failed (${mappingFailures.join('; ')})`);
        }
        if (narrativeFailures.length > 0) {
            summaries.push(`${narrativeFailures.length} narrative document(s) failed (${narrativeFailures.join('; ')})`);
        }
        throw new Error(
            `Push failed: ${summaries.join(' ')}`
        );
    }
}

async function pushNarrativeEntry(
    entry: NarrativeWorkspaceManifestEntry,
    context: PushEntryContext
): Promise<void> {
    const { bundlePath, client, conflicts, failIfModified, id, manifest, narrativeFailures, raw } = context;
    try {
        const createRecovery = getCreateRecovery(entry);
        if (createRecovery !== undefined) {
            throw new Error(createReconciliationMessage(id, entry));
        }
        const resolved = resolveNarrativeEntry(id, entry, raw);
        const { version, narrative } = resolved;

        if (!resolved.hubIdentityAssigned) {
            const { identity } = resolved;
            if (version !== '1.0.0') {
                throw new Error('A narrative document without calmHubDocumentId must use version 1.0.0.');
            }

            manifest[id] = {
                path: entry.path,
                type: entry.type,
                ...(entry.namespace === undefined ? {} : { namespace: entry.namespace }),
                version,
                createRecovery: { pending: true },
            };
            // Persist recovery before POST because a transport failure can hide a successful create.
            await saveManifest(bundlePath, manifest);
            let location: string | undefined;
            try {
                location = await client.createNarrativeDocument(identity.namespace, identity.type, narrative.request);
            } catch (e) {
                if (isDefiniteCreateRejection(e)) {
                    manifest[id] = entry;
                    await saveManifest(bundlePath, manifest);
                }
                throw e;
            }

            if (location === undefined) {
                throw new Error(createReconciliationMessage(id, entry));
            }

            let documentId: number;
            try {
                documentId = parseNarrativeDocumentLocation(location, identity);
            } catch {
                throw new Error(createReconciliationMessage(id, entry));
            }

            manifest[id] = publishNarrativeEntry(entry, documentId, location);
            await saveManifest(bundlePath, manifest);
            logger.info(`Pushed '${id}' version ${version} -> ${location}`);
            return;
        }

        const { identity } = resolved;
        validateNarrativeDocumentLocation(entry.calmHubId, identity, false);
        const versions = await client.getNarrativeDocumentVersions(
            identity.namespace, identity.type, identity.calmHubDocumentId
        );
        if (!versions.includes(version)) {
            const location = await client.createNarrativeDocumentVersion(
                identity.namespace, identity.type, identity.calmHubDocumentId, version, narrative.request
            );
            validateNarrativeDocumentLocation(location, identity);
            manifest[id] = publishNarrativeEntry(entry, identity.calmHubDocumentId, location);
            await saveManifest(bundlePath, manifest);
            logger.info(`Pushed '${id}' version ${version} -> ${location}`);
            return;
        }

        if (!failIfModified) {
            logger.info(`No changes for '${id}' - version ${version} already exists, skipping`);
            return;
        }
        const remote = await client.getNarrativeDocumentVersion(
            identity.namespace, identity.type, identity.calmHubDocumentId, version
        );
        if (remote.documentMarkdown !== raw) {
            logger.error(`'${id}' version ${version} already exists in CalmHub but differs on disk. Bump it before pushing.`);
            conflicts.push(`${id}@${version}`);
        } else {
            logger.info(`No changes for '${id}' - version ${version} already exists and is unchanged, skipping`);
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error(`Failed to push narrative document '${id}': ${message}`);
        narrativeFailures.push(`${id}: ${message}`);
    }
}

async function pushMappingEntry(
    entry: MappingWorkspaceManifestEntry,
    context: PushEntryContext
): Promise<void> {
    const { bundlePath, client, conflicts, failIfModified, id, manifest, mappingFailures, raw } = context;
    // The mapping API addresses resources by (namespace, type, mappingId, version),
    // all encoded in the document's $id. Documents without a well-formed mapping $id
    // (or whose type has no ResourceType, e.g. flow/adr) cannot be pushed and are skipped.
    let metadata: DocumentMetadata;
    try {
        metadata = extractDocumentMetadata(raw);
    } catch (e) {
        logger.warn(
            `Skipping '${id}': not mappable to CalmHub. Documents must have a '$id' of the form ` +
            '$BASE_URL/calm/namespaces/$NAMESPACE/$TYPE/$MAPPING_ID/versions/$VERSION ' +
            `(${e instanceof Error ? e.message : String(e)})`
        );
        return;
    }

    const { namespace, type: resourceType, mapping: mappingId, version } = metadata;
    if (!namespace) {
        logger.warn(`Skipping '${id}': document $id has no namespace.`);
        return;
    }

    let existingVersions: string[];
    try {
        existingVersions = await client.getMappedResourceVersions(namespace, mappingId, resourceType);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error(`Failed to fetch existing versions for '${id}' from CalmHub: ${message}`);
        mappingFailures.push(`${id}: ${message}`);
        return;
    }

    if (existingVersions.includes(version)) {
        if (!failIfModified) {
            logger.info(`No changes for '${id}' - version ${version} already exists, skipping`);
            return;
        }

        // Strict mode: an existing version is only a conflict if the on-disk content differs
        // from what is already published. Unchanged content is still skipped.
        let remote: object;
        try {
            remote = await client.getMappedResourceByVersion(namespace, mappingId, version, resourceType);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error(`Failed to fetch '${id}' @ ${version} from CalmHub to compare: ${message}`);
            mappingFailures.push(`${id}: ${message}`);
            return;
        }

        if (canonicalEqual(JSON.parse(raw), remote)) {
            logger.info(`No changes for '${id}' - version ${version} already exists and is unchanged, skipping`);
        } else {
            logger.error(`'${id}' version ${version} already exists in CalmHub but differs on disk. Bump it before pushing.`);
            conflicts.push(`${id}@${version}`);
        }
        return;
    }

    try {
        const calmHubId = await client.createMappedResourceVersion(metadata, raw);
        manifest[id] = { ...entry, calmHubId };
        await saveManifest(bundlePath, manifest);
        logger.info(`Pushed '${id}' version ${version} -> ${calmHubId}`);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error(`Failed to push '${id}': ${message}`);
        mappingFailures.push(`${id}: ${message}`);
    }
}

function getCreateRecovery(entry: NarrativeWorkspaceManifestEntry): NarrativeCreateRecovery | undefined {
    const createRecovery = (entry as unknown as Record<string, unknown>).createRecovery;
    if (createRecovery === undefined) return undefined;

    if (entry.calmHubDocumentId !== undefined || entry.calmHubId !== undefined) {
        throw new Error('Narrative document cannot be both published and pending create recovery.');
    }
    if (!createRecovery || typeof createRecovery !== 'object' || Array.isArray(createRecovery)) {
        throw new Error('Narrative document createRecovery must be a pending-create marker.');
    }
    if ((createRecovery as Record<string, unknown>).pending !== true || Object.keys(createRecovery).length !== 1) {
        throw new Error('Narrative document createRecovery must contain only pending: true.');
    }
    return { pending: true };
}

function isDefiniteCreateRejection(error: unknown): boolean {
    return error instanceof HubClientError && DEFINITE_CREATE_REJECTION_STATUSES.has(error.status);
}

function createReconciliationMessage(id: string, entry: NarrativeWorkspaceManifestEntry): string {
    return `Narrative document '${id}' has a pending create with no authoritative CalmHub identity. ` +
        'Explicit reconciliation is required. Confirm the CalmHub document ID, then run ' +
        `\`calm workspace add <file> --id ${id} --type ${entry.type} --namespace ${entry.namespace ?? '<namespace>'} ` +
        `--calm-hub-document-id <id> --ver ${entry.version}\` ` +
        '(add `--calm-hub-url <url>` if it is not configured).';
}

function publishNarrativeEntry(
    entry: NarrativeWorkspaceManifestEntry,
    documentId: number,
    location: string
): PublishedNarrativeWorkspaceManifestEntry {
    return {
        path: entry.path,
        type: entry.type,
        ...(entry.namespace === undefined ? {} : { namespace: entry.namespace }),
        version: entry.version,
        calmHubDocumentId: documentId,
        calmHubId: location,
    };
}
