import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { loadManifest, resolveFilePath, extractAllReferences } from './bundle';
import { buildRefRulesFromDiskIds, syncReferences, stripVersionSuffix, RefRule } from './ref-rewrite';
import { applyVersionToDocument } from './bump';
import {
    CalmHubClient,
    ResourceChangeType,
    DocumentMetadata,
    extractDocumentMetadata,
    computeSemVerBump,
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

/**
 * Resolves a reference string to the tracked document id it points at, using the same matching
 * rules as `ref-rewrite.ts`'s `resolveNewRef` (bare id, or a CalmHub path/URL at any version whose
 * base matches the rule's current base path) — but returning the target id instead of a rewrite.
 */
function refTargetId(ref: string, rules: RefRule[]): string | null {
    const fragmentIdx = ref.indexOf('#');
    const baseRef = fragmentIdx >= 0 ? ref.slice(0, fragmentIdx) : ref;

    for (const rule of rules) {
        if (baseRef === rule.bareId || baseRef === rule.targetPath) return rule.bareId;
        if (rule.basePath) {
            const stripped = stripVersionSuffix(baseRef);
            if ((stripped !== null && stripped === rule.basePath) || baseRef === rule.basePath) {
                return rule.bareId;
            }
        }
    }
    return null;
}

/**
 * Returns the ids of tracked documents that `id` references (directly) and that are still at a
 * `-SNAPSHOT` version. Used to block releasing (or checking) a document that would otherwise bake
 * in a reference to mutable content.
 */
export async function findSnapshotDependencies(bundlePath: string, id: string): Promise<string[]> {
    const manifest = await loadManifest(bundlePath);
    const entry = manifest[id];
    if (!entry) return [];
    const filePath = resolveFilePath(bundlePath, entry.path);
    if (!existsSync(filePath)) return [];

    let json: object;
    try {
        json = JSON.parse(await readFile(filePath, 'utf8'));
    } catch {
        return [];
    }

    const rules = await buildRefRulesFromDiskIds(manifest, bundlePath);
    const refs = extractAllReferences(json);

    const snapshotDeps = new Set<string>();
    for (const ref of refs) {
        const targetId = refTargetId(ref, rules);
        if (!targetId || targetId === id) continue;

        const targetEntry = manifest[targetId];
        if (!targetEntry) continue;
        const targetPath = resolveFilePath(bundlePath, targetEntry.path);
        if (!existsSync(targetPath)) continue;

        try {
            const targetRaw = await readFile(targetPath, 'utf8');
            const metadata = extractDocumentMetadata(targetRaw);
            if (isSnapshotVersion(metadata.version)) {
                snapshotDeps.add(targetId);
            }
        } catch {
            // Not a CalmHub-mappable document (flow, adr, timeline, etc.) — can't be a snapshot.
            continue;
        }
    }
    return [...snapshotDeps];
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
    const manifest = await loadManifest(bundlePath);
    const violations: SnapshotDependencyViolation[] = [];

    for (const [id, entry] of Object.entries(manifest)) {
        const filePath = resolveFilePath(bundlePath, entry.path);
        if (!existsSync(filePath)) continue;

        let raw: string;
        try {
            raw = await readFile(filePath, 'utf8');
        } catch {
            continue;
        }

        let metadata: DocumentMetadata;
        try {
            metadata = extractDocumentMetadata(raw);
        } catch {
            continue;
        }
        if (isSnapshotVersion(metadata.version)) continue;

        const dependsOn = await findSnapshotDependencies(bundlePath, id);
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

async function writeNewVersion(bundlePath: string, filePath: string, raw: string, metadata: DocumentMetadata, toVersion: string): Promise<void> {
    const updated = applyVersionToDocument(raw, { ...metadata, version: toVersion });
    await writeFile(filePath, updated, 'utf8');

    const manifest = await loadManifest(bundlePath);
    const rules = await buildRefRulesFromDiskIds(manifest, bundlePath);
    const refUpdates = await syncReferences(bundlePath, manifest, rules);
    const refChanges = refUpdates.reduce((sum, r) => sum + r.changeCount, 0);
    if (refChanges > 0) {
        logger.info(`Updated ${refChanges} reference(s) across the workspace to match.`);
    }
}

/**
 * Marks a tracked document as a mutable `-SNAPSHOT` version.
 *
 * If the on-disk version is already published on CalmHub, it is bumped first (by `increment`)
 * before the suffix is appended — the same idempotency guard `detectChangedResources` uses. If
 * the on-disk version isn't published yet (brand new, or already bumped but unpushed), it is
 * snapshotted in place.
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
            baseVersion = computeSemVerBump(metadata.version, options.increment);
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
 * itself still a snapshot — releasing it would bake in a reference to mutable content.
 */
export async function releaseSnapshot(bundlePath: string, id: string): Promise<SnapshotResult> {
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
    await writeNewVersion(bundlePath, filePath, raw, metadata, toVersion);

    logger.info(`Released '${id}' ${metadata.version} -> ${toVersion}`);
    return { id, fromVersion: metadata.version, toVersion };
}
