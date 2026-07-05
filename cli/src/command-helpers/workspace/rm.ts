import { initLogger } from '@finos/calm-shared/src/logger';
import { loadManifest, saveManifest } from './bundle';

const logger = initLogger(false, 'workspace-rm');

export async function removeDocumentFromManifest(bundlePath: string, id: string): Promise<boolean> {
    const manifest = await loadManifest(bundlePath);
    if (!Object.prototype.hasOwnProperty.call(manifest, id)) {
        logger.error(`No document with id '${id}' found in the workspace bundle.`);
        return false;
    }
    delete manifest[id];
    await saveManifest(bundlePath, manifest);
    logger.info(`Removed '${id}' from workspace bundle.`);
    return true;
}
