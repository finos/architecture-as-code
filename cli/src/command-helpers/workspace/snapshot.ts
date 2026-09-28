import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { loadManifest, resolveFilePath, extractAllReferences, WorkspaceManifest } from './bundle';
import { buildRefRulesFromDiskIds, syncReferences, findRuleForRef, RefRule } from './ref-rewrite';
import { applyVersionToDocument } from './bump';
import {
    CalmHubClient,
    ResourceChangeType,
    DocumentMetadata,
    extractDocumentMetadata,
    computeSemVerBump,
    latestReleaseVersion,
    isSnapshotVersion,
    toSnapshotVersion,
    toReleaseVersion,
    initLogger,
    Logger,
} from '@finos/calm-shared';

const logger: Logger = initLogger(false, 'workspace');

export interface SnapshotResult {
    id: string;
    fromVersion: string;
    toVersion: string;
}

/** The version segment embedded in a ref, or null for a bare-id ref with no version. */
function extractRefVersion(ref: string): string | null {
    const fragmentIdx = ref.indexOf('#');
    const baseRef = fragmentIdx >= 0 ? ref.slice(0, fragmentIdx) : ref;
    const m = baseRef.match(/\/versions\/([^/#]+)$/);
    return m ? m[1] : null;
}

type SnapshotContext = {
    manifest: WorkspaceManifest;
    rules: RefRule[];
    versionById: Map<string, string>;
};

/** Loads the manifest, ref rules, and each doc's on-disk version exactly once. */
async function buildSnapshotContext(bundlePath: string): Promise<SnapshotContext> {
    const manifest = await loadManifest(bundlePath);
    const rules = await buildRefRulesFromDiskIds(manifest, bundlePath);
    const versionById = new Map<string, string>();
    for (const [id, entry] of Object.entries(manifest)) {
        const filePath = resolveFilePath(bundlePath, entry.path);
        if (!existsSync(filePath)) continue;
        try {
            const raw = await readFile(filePath, 'utf8');
            versionById.set(id, extractDocumentMetadata(raw).version);
        } catch {
            continue;
        }
    }
    return { manifest, rules, versionById };
}

async function snapshotDependenciesFor(bundlePath: string, id: string, ctx: SnapshotContext): Promise<string[]> {
    const entry = ctx.manifest[id];
    if (!entry) return [];
    const filePath = resolveFilePath(bundlePath, entry.path);
    if (!existsSync(filePath)) return [];

    let json: object;
    try {
        json = JSON.parse(await readFile(filePath, 'utf8'));
    } catch {
        return [];
    }

    const snapshotDeps = new Set<string>();
    for (const ref of extractAllReferences(json)) {
        const rule = findRuleForRef(ref, ctx.rules);
        if (!rule || rule.bareId === id) continue;

        // A ref pinned to a specific version is a snapshot dependency only if that version is
        // itself a snapshot; a bare-id ref has no pinned version, so it depends on whatever the
        // target's current on-disk version is.
        const version = extractRefVersion(ref) ?? ctx.versionById.get(rule.bareId);
        if (version && isSnapshotVersion(version)) {
            snapshotDeps.add(rule.bareId);
        }
    }
    return [...snapshotDeps];
}

/**
 * Returns the ids of tracked documents that `id` references (directly) and that are still at a
 * `-SNAPSHOT` version. Used to block releasing (or checking) a document that would otherwise bake
 * in a reference to mutable content.
 */
export async function findSnapshotDependencies(bundlePath: string, id: string): Promise<string[]> {
    const ctx = await buildSnapshotContext(bundlePath);
    return snapshotDependenciesFor(bundlePath, id, ctx);
}

export interface SnapshotDependencyViolation {
    id: string;
    dependsOn: string[];
}

/**
 * Scans every tracked document that is not itself a snapshot and reports any that reference a
 * tracked document still at a `-SNAPSHOT` version — the same guard `releaseSnapshot` enforces,
 * applied workspace-wide as the `workspace check` CI gate.
 */
export async function findSnapshotDependencyViolations(bundlePath: string): Promise<SnapshotDependencyViolation[]> {
    const ctx = await buildSnapshotContext(bundlePath);
    const violations: SnapshotDependencyViolation[] = [];

    for (const id of Object.keys(ctx.manifest)) {
        const version = ctx.versionById.get(id);
        if (!version || isSnapshotVersion(version)) continue;

        const dependsOn = await snapshotDependenciesFor(bundlePath, id, ctx);
        if (dependsOn.length > 0) {
            violations.push({ id, dependsOn });
        }
    }

    return violations;
}

async function loadTrackedDocument(bundlePath: string, id: string): Promise<{ filePath: string; raw: string; metadata: DocumentMetadata }> {
    const manifest = await loadManifest(bundlePath);
    const entry = manifest[id];
    if (!entry) {
        throw new Error(`No document with id '${id}' is tracked in this workspace.`);
    }

    const filePath = resolveFilePath(bundlePath, entry.path);
    if (!existsSync(filePath)) {
        throw new Error(`File not found for id '${id}': ${filePath}`);
    }

    const raw = await readFile(filePath, 'utf8');

    let metadata: DocumentMetadata;
    try {
        metadata = extractDocumentMetadata(raw);
    } catch (e) {
        throw new Error(
            `'${id}' is not mappable to CalmHub: documents must have a '$id' of the form ` +
            '$BASE_URL/calm/namespaces/$NAMESPACE/$TYPE/$MAPPING_ID/versions/$VERSION ' +
            `(${e instanceof Error ? e.message : String(e)})`
        );
    }

    return { filePath, raw, metadata };
}

/** Tracked documents that are themselves at a `-SNAPSHOT` version — safe to auto-relink. */
async function snapshotOnlyManifest(bundlePath: string, manifest: WorkspaceManifest): Promise<WorkspaceManifest> {
    const filtered: WorkspaceManifest = {};
    for (const [id, entry] of Object.entries(manifest)) {
        const filePath = resolveFilePath(bundlePath, entry.path);
        if (!existsSync(filePath)) continue;
        try {
            const raw = await readFile(filePath, 'utf8');
            if (isSnapshotVersion(extractDocumentMetadata(raw).version)) {
                filtered[id] = entry;
            }
        } catch {
            continue;
        }
    }
    return filtered;
}

async function writeNewVersion(bundlePath: string, filePath: string, raw: string, metadata: DocumentMetadata, toVersion: string): Promise<void> {
    const updated = applyVersionToDocument(raw, { ...metadata, version: toVersion });
    await writeFile(filePath, updated, 'utf8');

    // Only relink documents that are themselves snapshots: they're mutable, so updating their
    // refs doesn't touch already-published content. A release must be bumped deliberately.
    const manifest = await loadManifest(bundlePath);
    const rules = await buildRefRulesFromDiskIds(manifest, bundlePath);
    const snapshotDocs = await snapshotOnlyManifest(bundlePath, manifest);
    const refUpdates = await syncReferences(bundlePath, snapshotDocs, rules);
    const refChanges = refUpdates.reduce((sum, r) => sum + r.changeCount, 0);
    if (refChanges > 0) {
        logger.info(`Updated ${refChanges} reference(s) across the workspace to match.`);
    }
}

/**
 * Marks a tracked document as a mutable `-SNAPSHOT` version.
 *
 * If the on-disk version is already published on CalmHub, it is bumped first (by `increment`,
 * from the highest published release) before the suffix is appended. If the on-disk version
 * isn't published yet (brand new, or already bumped but unpushed), it is snapshotted in place.
 */
export async function markAsSnapshot(
    bundlePath: string,
    id: string,
    client: CalmHubClient,
    options: { increment: ResourceChangeType }
): Promise<SnapshotResult> {
    const { filePath, raw, metadata } = await loadTrackedDocument(bundlePath, id);

    if (isSnapshotVersion(metadata.version)) {
        throw new Error(`'${id}' is already a snapshot at version ${metadata.version}.`);
    }

    let baseVersion = metadata.version;
    if (metadata.namespace) {
        const existingVersions = await client.getMappedResourceVersions(metadata.namespace, metadata.mapping, metadata.type);
        if (existingVersions.includes(metadata.version)) {
            baseVersion = computeSemVerBump(latestReleaseVersion(existingVersions), options.increment);
        }
    }

    const toVersion = toSnapshotVersion(baseVersion);
    await writeNewVersion(bundlePath, filePath, raw, metadata, toVersion);

    logger.info(`Snapshotted '${id}' ${metadata.version} -> ${toVersion}`);
    return { id, fromVersion: metadata.version, toVersion };
}

/**
 * Releases a snapshotted document: strips the `-SNAPSHOT` suffix, turning it back into an
 * immutable release version. Refuses if the document still references a tracked document that is
 * itself still a snapshot, or if the release version is already published (e.g. by someone else).
 */
export async function releaseSnapshot(bundlePath: string, id: string, client: CalmHubClient): Promise<SnapshotResult> {
    const { filePath, raw, metadata } = await loadTrackedDocument(bundlePath, id);

    if (!isSnapshotVersion(metadata.version)) {
        throw new Error(`'${id}' is not currently a snapshot (version ${metadata.version}).`);
    }

    const snapshotDeps = await findSnapshotDependencies(bundlePath, id);
    if (snapshotDeps.length > 0) {
        throw new Error(
            `Cannot release '${id}': it depends on snapshot version(s) of ${snapshotDeps.join(', ')}. ` +
            'Release those first.'
        );
    }

    const toVersion = toReleaseVersion(metadata.version);

    if (metadata.namespace) {
        const existingVersions = await client.getMappedResourceVersions(metadata.namespace, metadata.mapping, metadata.type);
        if (existingVersions.includes(toVersion)) {
            throw new Error(`Cannot release '${id}': version ${toVersion} already exists in CalmHub. Bump it instead.`);
        }
    }

    await writeNewVersion(bundlePath, filePath, raw, metadata, toVersion);

    logger.info(`Released '${id}' ${metadata.version} -> ${toVersion}`);
    return { id, fromVersion: metadata.version, toVersion };
}
