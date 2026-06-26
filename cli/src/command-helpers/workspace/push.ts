import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { loadManifest, saveManifest } from './bundle';
import { CalmHubClient } from '@finos/calm-shared/src/hub/calm-hub-client';
import { DocumentMetadata, extractDocumentMetadata } from '@finos/calm-shared/src/hub/document-id-utils';
import { initLogger, Logger } from '@finos/calm-shared/src/logger';

const logger: Logger = initLogger(false, 'workspace');

export async function pushWorkspaceToHub(bundlePath: string, client: CalmHubClient): Promise<void> {
    const manifest = await loadManifest(bundlePath);
    const entries = Object.entries(manifest);

    if (entries.length === 0) {
        logger.warn('No files in workspace manifest to push.');
        return;
    }

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
            logger.info(`No changes for '${id}' - version ${version} already exists, skipping`);
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
}
