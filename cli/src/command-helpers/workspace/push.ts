import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { createHash } from 'node:crypto';
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
    extractDocumentMetadata,
    initLogger,
    Logger,
} from '@finos/calm-shared';
import { canonicalEqual } from './bump';
import {
    constructNarrativeDocumentPath,
    parseNarrativeDocumentLocation,
    resolveNarrativeEntry,
    type NarrativeDocumentIdentity,
    validateNarrativeDocumentLocation,
} from './narrative-document';
import {
    dispatchWorkspaceManifestEntry,
    resolveWorkspaceManifestEntry,
    type WorkspaceManifestEntryOperations,
} from './document-kind';

const logger: Logger = initLogger(false, 'workspace');

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
        const resolved = resolveNarrativeEntry(id, entry, raw);
        const { version, narrative } = resolved;

        if (!resolved.hubIdentityAssigned) {
            const { identity } = resolved;
            if (version !== '1.0.0') {
                throw new Error('A narrative document without calmHubDocumentId must use version 1.0.0.');
            }

            if (createRecovery !== undefined) {
                if (sha256(narrative.request.documentMarkdown) !== createRecovery.documentMarkdownSha256) {
                    throw new Error('Narrative document Markdown changed while create recovery is pending. Restore the submitted content or reconcile it explicitly.');
                }
                const recovered = await recoverCreatedNarrativeDocument(
                    client, identity, createRecovery.documentIdsBeforeCreate, narrative.request.documentMarkdown
                );
                manifest[id] = publishNarrativeEntry(entry, recovered.documentId, recovered.location);
                await saveManifest(bundlePath, manifest);
                logger.info(`Recovered '${id}' version ${version} -> ${recovered.location}`);
                return;
            }

            const documentIdsBeforeCreate = await client.getNarrativeDocumentIds(identity.namespace, identity.type);
            manifest[id] = {
                path: entry.path,
                type: entry.type,
                ...(entry.namespace === undefined ? {} : { namespace: entry.namespace }),
                version,
                createRecovery: {
                    documentIdsBeforeCreate,
                    documentMarkdownSha256: sha256(narrative.request.documentMarkdown),
                },
            };
            // Persist recovery before POST because a transport failure can hide a successful create.
            await saveManifest(bundlePath, manifest);
            const location = await client.createNarrativeDocument(identity.namespace, identity.type, narrative.request);

            let documentId: number | undefined;
            if (location !== undefined) {
                try {
                    documentId = parseNarrativeDocumentLocation(location, identity);
                } catch {
                    // The POST succeeded, but the Location cannot establish the document identity.
                }
            }

            if (documentId !== undefined && location !== undefined) {
                manifest[id] = publishNarrativeEntry(entry, documentId, location);
                await saveManifest(bundlePath, manifest);
                logger.info(`Pushed '${id}' version ${version} -> ${location}`);
                return;
            }

            const recovered = await recoverCreatedNarrativeDocument(
                client, identity, documentIdsBeforeCreate, narrative.request.documentMarkdown
            );
            manifest[id] = publishNarrativeEntry(entry, recovered.documentId, recovered.location);
            await saveManifest(bundlePath, manifest);
            logger.info(`Pushed '${id}' version ${version} -> ${recovered.location}`);
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
        throw new Error('Narrative document createRecovery must contain a valid documentIdsBeforeCreate array.');
    }
    const documentIdsBeforeCreate = (createRecovery as Record<string, unknown>).documentIdsBeforeCreate;
    if (!Array.isArray(documentIdsBeforeCreate) ||
        !documentIdsBeforeCreate.every((documentId: unknown) => Number.isSafeInteger(documentId) && (documentId as number) > 0)) {
        throw new Error('Narrative document createRecovery documentIdsBeforeCreate must contain only positive safe integers.');
    }
    const documentMarkdownSha256 = (createRecovery as Record<string, unknown>).documentMarkdownSha256;
    if (typeof documentMarkdownSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(documentMarkdownSha256)) {
        throw new Error('Narrative document createRecovery documentMarkdownSha256 must be a lowercase SHA-256 hex digest.');
    }
    return { documentIdsBeforeCreate, documentMarkdownSha256 };
}

function sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
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

async function recoverCreatedNarrativeDocument(
    client: CalmHubClient,
    identity: NarrativeDocumentIdentity,
    documentIdsBeforeCreate: number[],
    documentMarkdown: string
): Promise<{ documentId: number; location: string }> {
    const documentIdsAfterCreate = await client.getNarrativeDocumentIds(identity.namespace, identity.type);
    const existingIds = new Set(documentIdsBeforeCreate);
    const candidateIds = [...new Set(documentIdsAfterCreate.filter((documentId) => !existingIds.has(documentId)))];
    const matchingIds: number[] = [];

    for (const candidateId of candidateIds) {
        const candidate = await client.getNarrativeDocumentVersion(
            identity.namespace, identity.type, candidateId, '1.0.0'
        );
        if (candidate.documentMarkdown === documentMarkdown) {
            matchingIds.push(candidateId);
        }
    }

    if (matchingIds.length === 0) {
        throw new Error('Could not recover the created narrative document: no new document has matching Markdown.');
    }
    if (matchingIds.length > 1) {
        throw new Error('Could not recover the created narrative document: multiple new documents have matching Markdown.');
    }

    const documentId = matchingIds[0];
    const location = constructNarrativeDocumentPath({ ...identity, calmHubDocumentId: documentId });
    return { documentId, location };
}
