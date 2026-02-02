import path from 'path';
import { mkdir, copyFile, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { JSONPath } from 'jsonpath-plus';
import { printBundleTreeFromGraph } from './tree';

/**
 * Property names that can contain document references (URLs or paths) in CALM JSON.
 * These are scanned during pull and dependency graph building.
 */
export const REFERENCE_PROPERTIES = ['$ref', , '$schema', 'requirement-url', 'config-url'] as const;

/**
 * Extract a reference URL from a value that may be either:
 * 1. A direct string value (e.g., "https://example.com/schema.json")
 * 2. A JSON Schema const object (e.g., { "const": "https://example.com/schema.json" })
 *
 * @param value The value to extract a reference from
 * @returns The extracted string reference, or null if no valid reference found
 */
export function extractReferenceValue(value: unknown): string | null {
    if (typeof value === 'string') {
        return value;
    }
    if (value && typeof value === 'object' && 'const' in value) {
        const constValue = (value as { const: unknown }).const;
        if (typeof constValue === 'string') {
            return constValue;
        }
    }
    return null;
}

export type BundleManifest = Record<string, string>;
export type DependencyGraph = {
    nodes: string[]; // ids
    edges: Record<string, string[]>; // id -> referenced ids
    idToPath: Record<string, string>;
};

export const MANIFEST_FILENAME = 'workspace-manifest.json';
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
    opts?: { id?: string; destName?: string, copy?: boolean }
): Promise<{ id: string; destPath: string; rel: string }> {

    const id = await determineDocumentId(srcPath, opts?.id);
    let rel: string;
    let destPath: string;

    if (opts?.copy) {
        const filesDir = path.join(bundlePath, FILES_DIRNAME);
        await mkdir(filesDir, { recursive: true });

        const destName = opts.destName ?? path.basename(srcPath);
        destPath = path.join(filesDir, destName);
        await copyFile(srcPath, destPath);
        rel = path.relative(bundlePath, destPath);
    } else {
        // reference the original file
        destPath = srcPath;
        rel = path.relative(bundlePath, srcPath);
    }

    const manifest = await loadManifest(bundlePath);
    manifest[id] = rel;
    await saveManifest(bundlePath, manifest);

    return { id, destPath, rel };
}

/**
 * Add an in-memory JSON object into the workspace bundle and register it in the manifest.
 * The object will be saved as JSON under 'files/<sanitised-id>.json'.
 * @param bundlePath Absolute path to the bundle directory
 * @param obj The object to serialize and store
 * @param explicitId Optional explicit id to use for the object
 */
export async function addObjectToBundle(
    bundlePath: string,
    obj: any,
    explicitId?: string
): Promise<{ id: string; destPath: string; rel: string }> {
    // We will determine id using the same logic but since we don't have a source file,
    // prefer explicitId, then $id property on the object, then fallback to a generated name.
    let id = explicitId && explicitId.trim() ? explicitId.trim() : undefined;
    if (!id && obj && typeof obj['$id'] === 'string' && obj['$id'].trim()) {
        id = obj['$id'].trim();
    }
    if (!id) {
        throw new Error('Cannot add object to bundle: no explicit id provided and object has no $id property.');
    }

    // sanitise id for filename
    const filename = id.replace(/[^a-zA-Z0-9-_\.]/g, '-').replace(/^-+|-+$/g, '') + '.json';
    const filesDir = path.join(bundlePath, FILES_DIRNAME);
    await mkdir(filesDir, { recursive: true });
    const destPath = path.join(filesDir, filename);
    const rel = path.relative(bundlePath, destPath);

    await writeFile(destPath, JSON.stringify(obj, null, 2), 'utf8');

    const manifest = await loadManifest(bundlePath);
    manifest[id] = rel;
    await saveManifest(bundlePath, manifest);

    return { id, destPath, rel };
}

/**
 * Build a dependency graph for the bundle where edges point from a document id to other document ids it references.
 * Only references that resolve to ids present in the bundle manifest are included as edges.
 */
export async function buildDependencyGraph(bundlePath: string): Promise<DependencyGraph> {
    const manifest = await loadManifest(bundlePath);
    const idToPath: Record<string, string> = {};
    for (const [id, rel] of Object.entries(manifest)) {
        idToPath[id] = path.join(bundlePath, rel);
    }

    const edges: Record<string, string[]> = {};

    for (const id of Object.keys(manifest)) {
        const filePath = idToPath[id];
        let json: any = null;
        try {
            const raw = await readFile(filePath, 'utf8');
            json = JSON.parse(raw);
        } catch (e) {
            // skip unreadable files
            continue;
        }

        // Extract all reference types from the document
        // Values can be direct strings or JSON Schema const objects
        const allRefs: string[] = [];
        for (const prop of REFERENCE_PROPERTIES) {
            const found = JSONPath({ path: `$..['${prop}']`, json }) as unknown[];
            for (const v of found) {
                const ref = extractReferenceValue(v);
                if (ref) {
                    allRefs.push(ref);
                }
            }
        }
        const refs = Array.from(new Set(allRefs));

        edges[id] = [];
        for (const ref of refs) {
            const refBase = ref.split('#')[0];
            // direct id match
            if (manifest[ref]) {
                edges[id].push(ref);
                continue;
            }
            // match by base (strip fragment)
            if (manifest[refBase]) {
                edges[id].push(refBase);
                continue;
            }
            // match by target file path (relative or absolute)
            let candidatePath: string;
            if (refBase.startsWith('http://') || refBase.startsWith('https://')) {
                // nothing more we can do
                continue;
            }
            // resolve relative to bundlePath
            candidatePath = path.resolve(bundlePath, refBase);
            const match = Object.entries(idToPath).find(([, p]) => path.resolve(p) === candidatePath);
            if (match) {
                edges[id].push(match[0]);
            }
        }
    }

    return { nodes: Object.keys(manifest), edges, idToPath };
}

/**
 * Print the dependency tree for the bundle to stdout.
 * Starts from nodes with no incoming edges by default.
 */
export async function printBundleTree(bundlePath: string): Promise<void> {
    const graph = await buildDependencyGraph(bundlePath);
    printBundleTreeFromGraph(graph, bundlePath);
}
