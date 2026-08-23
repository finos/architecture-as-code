import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { loadManifest, resolveFilePath, saveManifest } from './bundle';
import { buildRefRulesFromDiskIds, syncReferences, RefUpdateResult } from './ref-rewrite';
import { CalmHubClient, ResourceChangeType } from '@finos/calm-shared/src/hub/calm-hub-client';
import {
    DocumentMetadata,
    extractDocumentMetadata,
    constructDocumentId,
} from '@finos/calm-shared/src/hub/document-id-utils';
import { computeSemVerBump, sortSemVer } from '@finos/calm-shared/src/hub/semver';
import { canonicalEqual } from '@finos/calm-shared/src/hub/canonical';
import { initLogger, Logger } from '@finos/calm-shared/src/logger';
import { isNarrativeDocumentType } from '@finos/calm-models/types';
import { NarrativeDocumentIdentity, parseNarrativeDocument, validateNarrativeDocumentLocation, validateNarrativeIdentity, validateNarrativeNamespace } from './narrative-document';

// Re-exported for existing consumers (push.ts, tests) that import it from here.
export { canonicalEqual };

const logger: Logger = initLogger(false, 'workspace');

/**
 * Rewrites `$id`/`title` for a version bump without the empty-description default that
 * `updateDocumentMetadata` applies for CalmHub push normalisation (see hub-commands.ts, where it
 * mirrors how CalmHub stores a description-less document). Workspace documents are pushed raw
 * (see push.ts) and validated locally, so injecting `description: ''` into a document that never
 * had one would fail the `architecture-has-no-empty-string-properties` spectral rule.
 *
 * Unlike `updateDocumentMetadata` this parses/stringifies the document exactly once and only
 * touches `description` when it was already present, leaving description-less documents untouched.
 */
function bumpDocumentContent(raw: string, metadata: DocumentMetadata): string {
    const json = JSON.parse(raw);
    json['$id'] = constructDocumentId(metadata);
    json['title'] = metadata.name;
    if (Object.prototype.hasOwnProperty.call(json, 'description')) {
        json['description'] = metadata.description ?? '';
    }
    return JSON.stringify(json, null, 2);
}

interface ChangedResourceBase {
    id: string;
    filePath: string;
    currentVersion: string;
    latestHubVersion: string;
}

export type ChangedResource =
    | (ChangedResourceBase & { kind: 'mapping'; metadata: DocumentMetadata })
    | (ChangedResourceBase & { kind: 'narrative' });

export interface BumpResult {
    bumped: Array<{ id: string; filePath: string; fromVersion: string; toVersion: string; triggeredBy?: string; increment?: ResourceChangeType }>;
    refUpdates: RefUpdateResult[];
}

export interface BumpOptions {
    /** Fallback increment used when no per-doc override is present. */
    increment: ResourceChangeType;
    /** Per-document increment for directly-changed docs (from interactive prompts). */
    perDocIncrements?: Map<string, ResourceChangeType>;
    /** Pre-detected changed resources — skips a second detectChangedResources call inside bumpWorkspace. */
    preDetectedChanges?: ChangedResource[];
    /** Called for each cascade candidate before bumping. Return the increment to apply.
     *  When absent, the cascade default (max of triggering increments) is used silently. */
    getCascadeIncrement?: (docId: string, triggeredBy: string, defaultIncrement: ResourceChangeType) => Promise<ResourceChangeType>;
}

/** Returns the highest-priority increment from a list (MAJOR > MINOR > PATCH). */
export function maxIncrement(increments: ResourceChangeType[]): ResourceChangeType {
    if (increments.includes('MAJOR')) return 'MAJOR';
    if (increments.includes('MINOR')) return 'MINOR';
    return 'PATCH';
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
            if (isNarrativeDocumentType(entry.type)) throw new Error(`Narrative document '${id}' file not found: ${filePath}`);
            logger.warn(`File not found for id '${id}': ${filePath}`);
            continue;
        }

        let raw: string;
        try {
            raw = await readFile(filePath, 'utf8');
        } catch (e) {
            if (isNarrativeDocumentType(entry.type)) throw new Error(`Narrative document '${id}' could not be read: ${e instanceof Error ? e.message : String(e)}`);
            logger.warn(`Failed to read file for id '${id}': ${e instanceof Error ? e.message : String(e)}`);
            continue;
        }

        if (isNarrativeDocumentType(entry.type)) {
            const version = entry.version;
            if (!version) throw new Error(`Narrative document '${id}' has no manifest version.`);
            if ((entry.calmHubId === undefined) !== (entry.calmHubDocumentId === undefined)) {
                throw new Error(`Narrative document '${id}' has incomplete Hub identity. Re-add the document to repair it.`);
            }
            validateNarrativeNamespace(entry.namespace, id);
            const identity: NarrativeDocumentIdentity = {
                namespace: entry.namespace, type: entry.type, version, calmHubDocumentId: entry.calmHubDocumentId,
            };
            parseNarrativeDocument(raw, id);
            if (entry.calmHubDocumentId === undefined) {
                validateNarrativeIdentity(identity, false, id);
                continue;
            }
            validateNarrativeIdentity(identity, true, id);
            validateNarrativeDocumentLocation(entry.calmHubId, identity, false);
            const versions = await client.getNarrativeDocumentVersions(identity.namespace, identity.type, identity.calmHubDocumentId!);
            if (versions.length === 0 || !versions.includes(version)) continue;
            const remote = await client.getNarrativeDocumentVersion(
                identity.namespace, identity.type, identity.calmHubDocumentId!, version
            );
            if (remote.documentMarkdown === raw) continue;
            changed.push({
                id, filePath, currentVersion: version,
                latestHubVersion: sortSemVer(versions)[versions.length - 1], kind: 'narrative',
            });
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
            kind: 'mapping',
        });
    }

    return changed;
}

/**
 * Bump every changed document by one increment relative to CalmHub's latest version, then
 * cascade: any document whose references were rewritten is itself dirty and gets bumped too,
 * triggering another sync pass. Repeats until the workspace reaches a stable state.
 *
 * Supports per-document increments (for interactive prompts) and a callback for cascade docs.
 * Idempotent: once a document is bumped (its on-disk version is now ahead of CalmHub) a subsequent
 * bump leaves it untouched until the bumped version is pushed.
 */
export async function bumpWorkspace(
    bundlePath: string,
    client: CalmHubClient,
    options: BumpOptions
): Promise<BumpResult> {
    const changed = options.preDetectedChanges ?? await detectChangedResources(bundlePath, client);

    const bumped: BumpResult['bumped'] = [];
    const bumpedIds = new Set<string>();
    // Tracks the actual increment used for each bumped doc, so cascade passes can inherit it.
    const appliedIncrements = new Map<string, ResourceChangeType>();

    for (const c of changed) {
        const docIncrement = options.perDocIncrements?.get(c.id) ?? options.increment;
        const toVersion = computeSemVerBump(c.latestHubVersion, docIncrement);
        if (c.kind === 'narrative') {
            const manifest = await loadManifest(bundlePath);
            const entry = manifest[c.id];
            if (!entry) throw new Error(`Narrative document '${c.id}' is no longer in the manifest.`);
            manifest[c.id] = { ...entry, version: toVersion };
            await saveManifest(bundlePath, manifest);
            bumped.push({ id: c.id, filePath: c.filePath, fromVersion: c.currentVersion, toVersion, increment: docIncrement });
            appliedIncrements.set(c.id, docIncrement);
            bumpedIds.add(c.id);
            logger.info(`Bumped '${c.id}' ${c.currentVersion} -> ${toVersion}`);
            continue;
        }
        const raw = await readFile(c.filePath, 'utf8');
        const updated = bumpDocumentContent(raw, { ...c.metadata, version: toVersion });
        await writeFile(c.filePath, updated, 'utf8');
        bumped.push({ id: c.id, filePath: c.filePath, fromVersion: c.currentVersion, toVersion, increment: docIncrement });
        appliedIncrements.set(c.id, docIncrement);
        bumpedIds.add(c.id);
        logger.info(`Bumped '${c.id}' ${c.currentVersion} -> ${toVersion}`);
    }

    // Cascade: sync refs, then bump any document that was modified by the sync but not yet bumped.
    // Repeat until nothing new gets changed (fixed-point). Terminates because each iteration adds
    // at least one id to bumpedIds and the workspace is finite.
    const allRefUpdates: RefUpdateResult[] = [];
    const MAX_CASCADE_DEPTH = 50;

    // Track which IDs were bumped in the previous pass so each cascade log can name its trigger.
    let prevPassBumped = new Set<string>(bumpedIds);

    for (let depth = 0; depth < MAX_CASCADE_DEPTH; depth++) {
        const manifest = await loadManifest(bundlePath);
        const jsonManifest = Object.fromEntries(
            Object.entries(manifest).filter(([, entry]) => !isNarrativeDocumentType(entry.type))
        );
        const rules = await buildRefRulesFromDiskIds(jsonManifest, bundlePath);
        const refUpdates = await syncReferences(bundlePath, jsonManifest, rules);
        allRefUpdates.push(...refUpdates);

        const cascadeCandidates = refUpdates.filter(r => r.changeCount > 0 && !bumpedIds.has(r.docId));
        if (cascadeCandidates.length === 0) break;

        const thisPassBumped = new Set<string>();
        const triggerLabel = [...prevPassBumped].join(', ');
        const cascadeDefault = maxIncrement([...prevPassBumped].map(id => appliedIncrements.get(id) ?? options.increment));

        for (const candidate of cascadeCandidates) {
            const entry = manifest[candidate.docId];
            if (!entry) continue;

            const filePath = resolveFilePath(bundlePath, entry.path);
            let raw: string;
            try {
                raw = await readFile(filePath, 'utf8');
            } catch (e) {
                logger.warn(`Cannot cascade-bump '${candidate.docId}': ${e instanceof Error ? e.message : String(e)}`);
                bumpedIds.add(candidate.docId);
                continue;
            }

            let metadata: DocumentMetadata;
            try {
                metadata = extractDocumentMetadata(raw);
            } catch {
                // Non-CalmHub $id (flow, adr, timeline, etc.) — ref was updated but version cannot be bumped.
                logger.warn(`'${candidate.docId}' references ${triggerLabel} (updated) but its $id is not a CalmHub URL; version not bumped.`);
                bumpedIds.add(candidate.docId);
                continue;
            }

            const cascadeIncrement = options.getCascadeIncrement
                ? await options.getCascadeIncrement(candidate.docId, triggerLabel, cascadeDefault)
                : cascadeDefault;

            const toVersion = computeSemVerBump(metadata.version, cascadeIncrement);
            const updated = bumpDocumentContent(raw, { ...metadata, version: toVersion });
            await writeFile(filePath, updated, 'utf8');
            bumped.push({ id: candidate.docId, filePath, fromVersion: metadata.version, toVersion, triggeredBy: triggerLabel, increment: cascadeIncrement });
            appliedIncrements.set(candidate.docId, cascadeIncrement);
            bumpedIds.add(candidate.docId);
            thisPassBumped.add(candidate.docId);
            logger.info(`Bumped '${candidate.docId}' ${metadata.version} -> ${toVersion} (depends on ${triggerLabel})`);
        }

        prevPassBumped = thisPassBumped;
    }

    return { bumped, refUpdates: allRefUpdates };
}
