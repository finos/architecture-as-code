import path from 'path';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { loadManifest } from './bundle';
import { buildRefRulesFromDiskIds, syncReferences, RefUpdateResult } from './ref-rewrite';
import { CalmHubClient, ResourceChangeType } from '@finos/calm-shared/src/hub/calm-hub-client';
import {
    DocumentMetadata,
    extractDocumentMetadata,
    updateDocumentMetadata,
} from '@finos/calm-shared/src/hub/document-id-utils';
import { computeSemVerBump, sortSemVer } from '@finos/calm-shared/src/hub/semver';
import { canonicalEqual } from '@finos/calm-shared/src/hub/canonical';
import { initLogger, Logger } from '@finos/calm-shared/src/logger';

// Re-exported for existing consumers (push.ts, tests) that import it from here.
export { canonicalEqual };

const logger: Logger = initLogger(false, 'workspace');

export interface ChangedResource {
    id: string;
    filePath: string;
    metadata: DocumentMetadata;
    currentVersion: string;
    latestHubVersion: string;
}

export interface BumpResult {
    bumped: Array<{ id: string; filePath: string; fromVersion: string; toVersion: string }>;
    refUpdates: RefUpdateResult[];
}

function resolveFilePath(bundlePath: string, entryPath: string): string {
    return path.isAbsolute(entryPath) ? entryPath : path.join(bundlePath, entryPath);
}

/**
 * Detect tracked documents whose on-disk content has changed relative to CalmHub but whose version
 * has **not** yet been bumped.
 *
 * Per document (identity comes from the `$id`):
 *  - unmappable `$id` → warn and skip
 *  - no versions in CalmHub (brand-new resource) → skip (push will create it; nothing to bump)
 *  - on-disk version not present in CalmHub → skip — it is already ahead (bumped, not yet pushed);
 *    this is the idempotency guard that prevents a second bump from incrementing again
 *  - on-disk version exists in CalmHub and content differs → reported as changed (needs a bump)
 */
export async function detectChangedResources(
    bundlePath: string,
    client: CalmHubClient
): Promise<ChangedResource[]> {
    const manifest = await loadManifest(bundlePath);
    const changed: ChangedResource[] = [];

    for (const [id, entry] of Object.entries(manifest)) {
        const filePath = resolveFilePath(bundlePath, entry.path);
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

        let metadata: DocumentMetadata;
        try {
            metadata = extractDocumentMetadata(raw);
        } catch (e) {
            logger.warn(`Skipping '${id}': not mappable to CalmHub (${e instanceof Error ? e.message : String(e)})`);
            continue;
        }
        if (!metadata.namespace) {
            logger.warn(`Skipping '${id}': document $id has no namespace.`);
            continue;
        }

        let versions: string[];
        try {
            versions = await client.getMappedResourceVersions(metadata.namespace, metadata.mapping, metadata.type);
        } catch (e) {
            logger.error(`Failed to fetch versions for '${id}': ${e instanceof Error ? e.message : String(e)}`);
            continue;
        }

        if (versions.length === 0) continue;                 // new resource — nothing to bump
        if (!versions.includes(metadata.version)) continue;  // already ahead — already bumped

        let remote: object;
        try {
            remote = await client.getMappedResourceByVersion(metadata.namespace, metadata.mapping, metadata.version, metadata.type);
        } catch (e) {
            logger.error(`Failed to fetch '${id}' @ ${metadata.version} from CalmHub: ${e instanceof Error ? e.message : String(e)}`);
            continue;
        }

        if (canonicalEqual(JSON.parse(raw), remote)) continue; // unchanged

        changed.push({
            id,
            filePath,
            metadata,
            currentVersion: metadata.version,
            latestHubVersion: sortSemVer(versions)[versions.length - 1],
        });
    }

    return changed;
}

/**
 * Bump every changed document by one increment relative to CalmHub's latest version, then
 * synchronise references so all tracked documents point at the bumped `$id`s.
 *
 * Idempotent: once a document is bumped (its on-disk version is now ahead of CalmHub) a subsequent
 * bump leaves it untouched until the bumped version is pushed.
 */
export async function bumpWorkspace(
    bundlePath: string,
    client: CalmHubClient,
    options: { increment: ResourceChangeType }
): Promise<BumpResult> {
    const changed = await detectChangedResources(bundlePath, client);

    const bumped: BumpResult['bumped'] = [];
    for (const c of changed) {
        const toVersion = computeSemVerBump(c.latestHubVersion, options.increment);
        const raw = await readFile(c.filePath, 'utf8');
        const updated = updateDocumentMetadata(raw, { ...c.metadata, version: toVersion });
        await writeFile(c.filePath, updated, 'utf8');
        bumped.push({ id: c.id, filePath: c.filePath, fromVersion: c.currentVersion, toVersion });
        logger.info(`Bumped '${c.id}' ${c.currentVersion} -> ${toVersion}`);
    }

    // Re-scan all tracked docs and repoint every reference to each doc's current on-disk $id.
    const manifest = await loadManifest(bundlePath);
    const rules = await buildRefRulesFromDiskIds(manifest, bundlePath);
    const refUpdates = await syncReferences(bundlePath, manifest, rules);

    return { bumped, refUpdates };
}
