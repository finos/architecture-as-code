import path from 'path';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { loadManifest, REFERENCE_PROPERTIES, WorkspaceManifest } from './bundle';
import { initLogger, Logger } from '@finos/calm-shared/src/logger';

const logger: Logger = initLogger(false, 'workspace');

type RefRule = {
    bareId: string;
    targetPath: string;
    basePath: string | null;
};

export type RefUpdateResult = {
    docId: string;
    filePath: string;
    changeCount: number;
};

/**
 * Strip `/versions/<version>` suffix from a CalmHub path.
 * Returns the base path, or null if the input has no version segment.
 */
export function stripVersionSuffix(ref: string): string | null {
    const m = ref.match(/^(.+?)\/versions\/[^/#]+/);
    return m ? m[1] : null;
}

export function buildRefRules(manifest: WorkspaceManifest): RefRule[] {
    return Object.entries(manifest)
        .filter(([, entry]) => !!entry.calmHubId)
        .map(([id, entry]) => ({
            bareId: id,
            targetPath: entry.calmHubId!,
            basePath: stripVersionSuffix(entry.calmHubId!),
        }));
}

/**
 * Decide what a single ref string should be replaced with.
 * Returns the replacement string, or null if no change is needed.
 *
 * Handles three forms:
 *  1. Bare ID (e.g. "workshop-pattern") matching a manifest key
 *  2. CalmHub path with a stale version (e.g. /calm/namespaces/ns/doc/versions/1.0.0)
 *  3. Full CalmHub URL with a stale version (same but prefixed with https://host)
 *
 * Fragment identifiers (#/...) are preserved in the output.
 */
export function resolveNewRef(ref: string, rules: RefRule[]): string | null {
    const fragmentIdx = ref.indexOf('#');
    const baseRef = fragmentIdx >= 0 ? ref.slice(0, fragmentIdx) : ref;
    const fragment = fragmentIdx >= 0 ? ref.slice(fragmentIdx) : '';

    for (const rule of rules) {
        // Bare ID match
        if (baseRef === rule.bareId) {
            return rule.targetPath + fragment;
        }

        // Already at the target path — no change needed
        if (baseRef === rule.targetPath) return null;

        if (rule.basePath) {
            // Path form with a different version
            const stripped = stripVersionSuffix(baseRef);
            if (stripped !== null && stripped === rule.basePath) {
                return rule.targetPath + fragment;
            }

            // Full URL form — keep the same origin, replace only the path
            if (baseRef.startsWith('http://') || baseRef.startsWith('https://')) {
                try {
                    const url = new URL(baseRef);
                    const pathBase = stripVersionSuffix(url.pathname);
                    if (pathBase !== null && pathBase === rule.basePath) {
                        url.pathname = rule.targetPath;
                        const replacement = url.toString() + fragment;
                        return replacement !== ref ? replacement : null;
                    }
                } catch {
                    // invalid URL — skip
                }
            }
        }
    }
    return null;
}

function replaceRefValue(
    value: unknown,
    rules: RefRule[],
    replacements: Array<{ oldRef: string; newRef: string }>
): unknown {
    if (typeof value === 'string') {
        const newRef = resolveNewRef(value, rules);
        if (newRef !== null) {
            replacements.push({ oldRef: value, newRef });
            return newRef;
        }
        return value;
    }
    // JSON Schema const form: { "const": "url" }
    if (value && typeof value === 'object' && 'const' in value) {
        const constVal = (value as { const: unknown }).const;
        if (typeof constVal === 'string') {
            const newRef = resolveNewRef(constVal, rules);
            if (newRef !== null) {
                replacements.push({ oldRef: constVal, newRef });
                return { ...(value as object), const: newRef };
            }
        }
    }
    return value;
}

function replaceRefsInObject(
    obj: unknown,
    rules: RefRule[],
    replacements: Array<{ oldRef: string; newRef: string }>
): unknown {
    if (Array.isArray(obj)) {
        return obj.map(item => replaceRefsInObject(item, rules, replacements));
    }
    if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            if ((REFERENCE_PROPERTIES as readonly string[]).includes(key)) {
                result[key] = replaceRefValue(value, rules, replacements);
            } else {
                result[key] = replaceRefsInObject(value, rules, replacements);
            }
        }
        return result;
    }
    return obj;
}

export async function updateWorkspaceRefs(
    bundlePath: string,
    options?: { dryRun?: boolean }
): Promise<RefUpdateResult[]> {
    const manifest = await loadManifest(bundlePath);
    const rules = buildRefRules(manifest);

    if (rules.length === 0) {
        logger.warn('No documents with CalmHub IDs found. Run `calm workspace push` first.');
        return [];
    }

    const results: RefUpdateResult[] = [];

    for (const [id, entry] of Object.entries(manifest)) {
        const filePath = path.isAbsolute(entry.path) ? entry.path : path.join(bundlePath, entry.path);

        if (!existsSync(filePath)) {
            logger.warn(`File not found for '${id}': ${filePath}`);
            continue;
        }

        let json: unknown;
        try {
            const raw = await readFile(filePath, 'utf8');
            json = JSON.parse(raw);
        } catch (e) {
            logger.warn(`Could not parse '${id}': ${e instanceof Error ? e.message : String(e)}`);
            continue;
        }

        const replacements: Array<{ oldRef: string; newRef: string }> = [];
        const updated = replaceRefsInObject(json, rules, replacements);

        if (replacements.length > 0) {
            logger.info(`${id}:`);
            for (const r of replacements) {
                logger.info(`  ${r.oldRef} -> ${r.newRef}`);
            }
            if (!options?.dryRun) {
                await writeFile(filePath, JSON.stringify(updated, null, 2), 'utf8');
            }
        }

        results.push({ docId: id, filePath, changeCount: replacements.length });
    }

    return results;
}
