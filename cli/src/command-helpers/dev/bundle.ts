import path from 'path';
import { mkdir, copyFile, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

export type BundleManifest = Record<string, string>;

export const MANIFEST_FILENAME = 'bundle-manifest.json';
const FILES_DIRNAME = 'files';

/**
 * Load the bundle manifest from disk.
 * If the manifest does not exist or is invalid JSON, an empty manifest is returned.
 * @param bundlePath Absolute path to the bundle directory
 * @returns A mapping of document id -> relative file path within the bundle
 */
export async function loadManifest(bundlePath: string): Promise<BundleManifest> {
    const manifestPath = path.join(bundlePath, MANIFEST_FILENAME);
    if (!existsSync(manifestPath)) return {};
    try {
        const content = await readFile(manifestPath, 'utf8');
        return JSON.parse(content) as BundleManifest;
    } catch (e) {
        // If manifest is corrupted, return empty and overwrite on save
        return {};
    }
}

/**
 * Persist the bundle manifest to disk, overwriting any existing file.
 * @param bundlePath Absolute path to the bundle directory
 * @param manifest The manifest mapping to write
 */
export async function saveManifest(bundlePath: string, manifest: BundleManifest): Promise<void> {
    const manifestPath = path.join(bundlePath, MANIFEST_FILENAME);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

/**
 * Determine the document id for a source file.
 * Resolution precedence:
 *  - explicitId argument if provided and non-empty
 *  - the '$id' property in the JSON file
 *  - filename without extension as a fallback
 *
 * @param srcPath Absolute or relative path to the JSON file
 * @param explicitId Optional explicit id to use
 * @returns Resolved document id string
 */
export async function determineDocumentId(srcPath: string, explicitId?: string): Promise<string> {
    if (explicitId && typeof explicitId === 'string' && explicitId.trim()) {
        return explicitId.trim();
    }

    try {
        const raw = await readFile(srcPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed['$id'] === 'string' && parsed['$id'].trim()) {
            return parsed['$id'].trim();
        }
    } catch (e) {
        // ignore and fallback to filename
    }

    return path.basename(srcPath, path.extname(srcPath));
}

/**
 * Add a file into the workspace bundle and register it in the bundle manifest.
 * The file is copied into the bundle's 'files/' directory and the manifest is updated
 * to map the resolved document id to the file's relative path inside the bundle.
 *
 * @param bundlePath Absolute path to the bundle directory
 * @param srcPath Path to the source file to add
 * @param opts Optional options: { id?: explicit document id, destName?: filename to use inside bundle }
 * @returns Object containing the registered id, absolute destination path and relative path
 */
export async function addFileToBundle(
    bundlePath: string,
    srcPath: string,
    opts?: { id?: string; destName?: string }
): Promise<{ id: string; destPath: string; rel: string }> {
    const filesDir = path.join(bundlePath, FILES_DIRNAME);
    await mkdir(filesDir, { recursive: true });

    const destName = opts && opts.destName ? opts.destName : path.basename(srcPath);
    const destPath = path.join(filesDir, destName);

    await copyFile(srcPath, destPath);

    const id = await determineDocumentId(srcPath, opts && opts.id ? opts.id : undefined);

    const rel = path.relative(bundlePath, destPath);

    const manifest = await loadManifest(bundlePath);
    manifest[id] = rel;
    await saveManifest(bundlePath, manifest);

    return { id, destPath, rel };
}
