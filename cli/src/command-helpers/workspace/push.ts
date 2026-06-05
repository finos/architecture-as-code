import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { loadManifest, saveManifest } from './bundle';
import { CalmHubClient, HubClientError } from '@finos/calm-shared/src/hub/calm-hub-client';
import { CalmDocumentType } from '@finos/calm-shared/src/document-loader/document-loader';
import { initLogger, Logger } from '@finos/calm-shared/src/logger';

const logger: Logger = initLogger(false, 'workspace');

function minifyJson(obj: object): string {
    return JSON.stringify(obj);
}

export async function pushWorkspaceToHub(bundlePath: string, client: CalmHubClient): Promise<void> {
    const manifest = await loadManifest(bundlePath);
    const entries = Object.entries(manifest);

    if (entries.length === 0) {
        logger.warn('No files in workspace manifest to push.');
        return;
    }

    for (const [id, entry] of entries) {
        if (!entry.namespace) {
            logger.warn(`Skipping '${id}': no namespace set. Use --namespace when adding files, or re-add with 'calm workspace add --namespace <ns>'`);
            continue;
        }

        const namespace = entry.namespace;
        const filePath = path.isAbsolute(entry.path) ? entry.path : path.join(bundlePath, entry.path);

        if (!existsSync(filePath)) {
            logger.warn(`File not found for id '${id}': ${filePath}`);
            continue;
        }

        let localJson: object;
        try {
            const raw = await readFile(filePath, 'utf8');
            localJson = JSON.parse(raw);
        } catch (e) {
            logger.warn(`Failed to parse JSON for id '${id}': ${e instanceof Error ? e.message : String(e)}`);
            continue;
        }

        let remoteJson: object | null = null;
        try {
            remoteJson = await client.getResource(namespace, id);
        } catch (e: unknown) {
            if (e instanceof HubClientError && e.status === 404) {
                remoteJson = null;
            } else {
                logger.error(`Failed to fetch '${id}' from CalmHub: ${e instanceof Error ? e.message : String(e)}`);
                continue;
            }
        }

        if (remoteJson === null) {
            try {
                const calmHubId = await client.createResource(namespace, id, entry.type as CalmDocumentType, localJson);
                manifest[id] = { ...entry, calmHubId };
                await saveManifest(bundlePath, manifest);
                logger.info(`Created '${id}' -> ${calmHubId}`);
            } catch (e) {
                logger.error(`Failed to create '${id}': ${e instanceof Error ? e.message : String(e)}`);
            }
        } else if (minifyJson(localJson) !== minifyJson(remoteJson)) {
            try {
                const calmHubId = await client.updateResource(namespace, id, localJson);
                manifest[id] = { ...entry, calmHubId };
                await saveManifest(bundlePath, manifest);
                logger.info(`Updated '${id}' -> ${calmHubId}`);
            } catch (e) {
                logger.error(`Failed to update '${id}': ${e instanceof Error ? e.message : String(e)}`);
            }
        } else {
            logger.info(`No changes for '${id}' - skipping`);
        }
    }
}
