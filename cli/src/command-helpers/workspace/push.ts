import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { loadManifest, saveManifest } from './bundle';
import { CalmHubClient } from '@finos/calm-shared/src/hub/calm-hub-client';
import { DocumentMetadata, extractDocumentMetadata } from '@finos/calm-shared/src/hub/document-id-utils';
import { initLogger, Logger } from '@finos/calm-shared/src/logger';
import { canonicalEqual } from './bump';

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

    for (const [id, entry] of entries) {
        const filePath = path.isAbsolute(entry.path) ? entry.path : path.join(bundlePath, entry.path);

        if (!existsSync(filePath)) {
            logger.warn(`File not found for id '${id}': ${filePath}`);
            continue;
        }

        let raw: string;
        try {
            raw = await readFile(filePath, 'utf8');
        } catch (e) {
            logger.warn(`Failed to read file for id '${id}': ${e instanceof Error ? e.message : String(e)}`);
            continue;
        }

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
            continue;
        }

        const { namespace, type: resourceType, mapping: mappingId, version } = metadata;
        if (!namespace) {
            logger.warn(`Skipping '${id}': document $id has no namespace.`);
            continue;
        }

        let existingVersions: string[];
        try {
            existingVersions = await client.getMappedResourceVersions(namespace, mappingId, resourceType);
        } catch (e) {
            logger.error(`Failed to fetch existing versions for '${id}' from CalmHub: ${e instanceof Error ? e.message : String(e)}`);
            continue;
        }

        if (existingVersions.includes(version)) {
            if (!failIfModified) {
                logger.info(`No changes for '${id}' - version ${version} already exists, skipping`);
                continue;
            }

            // Strict mode: an existing version is only a conflict if the on-disk content differs
            // from what is already published. Unchanged content is still skipped.
            let remote: object;
            try {
                remote = await client.getMappedResourceByVersion(namespace, mappingId, version, resourceType);
            } catch (e) {
                logger.error(`Failed to fetch '${id}' @ ${version} from CalmHub to compare: ${e instanceof Error ? e.message : String(e)}`);
                continue;
            }

            if (canonicalEqual(JSON.parse(raw), remote)) {
                logger.info(`No changes for '${id}' - version ${version} already exists and is unchanged, skipping`);
            } else {
                logger.error(`'${id}' version ${version} already exists in CalmHub but differs on disk. Bump it before pushing.`);
                conflicts.push(`${id}@${version}`);
            }
            continue;
        }

        try {
            const calmHubId = await client.createMappedResourceVersion(metadata, raw);
            manifest[id] = { ...entry, calmHubId };
            await saveManifest(bundlePath, manifest);
            logger.info(`Pushed '${id}' version ${version} -> ${calmHubId}`);
        } catch (e) {
            logger.error(`Failed to push '${id}': ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    if (conflicts.length > 0) {
        throw new Error(
            `Push failed: ${conflicts.length} modified document(s) already exist in CalmHub at their declared ` +
            `version (${conflicts.join(', ')}). Run \`calm workspace bump\` to create new versions for them.`
        );
    }
}
