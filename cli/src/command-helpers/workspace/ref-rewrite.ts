import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { REFERENCE_PROPERTIES, WorkspaceManifest, resolveFilePath } from './bundle';
import { initLogger, Logger } from '@finos/calm-shared/src/logger';

const logger: Logger = initLogger(false, 'workspace');

/**
 * A rewrite rule for a single tracked document. References pointing at this document — by bare id,
 * by any versioned CalmHub path, or by full URL — are repointed to `targetPath` (the document's
 * current `$id`).
 */
export type RefRule = {
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
 * Strip the `/versions/<version>` suffix from a CalmHub path.
 * Returns the base path, or null if the input has no version segment.
 */
export function stripVersionSuffix(ref: string): string | null {
    const m = ref.match(/^(.+?)\/versions\/[^/#]+/);
    return m ? m[1] : null;
}

/**
 * Decide what a single ref string should be replaced with.
 * Returns the replacement string, or null if no change is needed.
 *
 * Handles three forms, preserving any `#/...` fragment:
 *  1. Bare ID (e.g. "workshop-pattern") matching a rule's bareId
 *  2. CalmHub path with a different version (e.g. /calm/namespaces/ns/type/doc/versions/1.0.0)
 *  3. Full CalmHub URL with a different version (same but prefixed with https://host)
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
            // Path form: versioned (different version) or unversioned (bare base path)
            const stripped = stripVersionSuffix(baseRef);
            if (stripped !== null && stripped === rule.basePath) {
                return rule.targetPath + fragment;
            }
            if (stripped === null && baseRef === rule.basePath) {
                return rule.targetPath + fragment;
            }

            // Full URL form — keep the same origin, replace only the path.
            if (baseRef.startsWith('http://') || baseRef.startsWith('https://')) {
                try {
                    const url = new URL(baseRef);
                    const pathBase = stripVersionSuffix(url.pathname);
                    let pathMatches = false;
                    let targetPathname: string;

                    if (rule.basePath && (rule.basePath.startsWith('http://') || rule.basePath.startsWith('https://'))) {
                        // rule.$id is a full URL — require same origin and compare pathnames
                        const ruleBase = new URL(rule.basePath);
                        pathMatches = url.origin === ruleBase.origin &&
                            ((pathBase !== null && pathBase === ruleBase.pathname) ||
                             url.pathname === ruleBase.pathname);
                        targetPathname = rule.targetPath.startsWith('http://') || rule.targetPath.startsWith('https://')
                            ? new URL(rule.targetPath).pathname
                            : rule.targetPath;
                    } else if (rule.basePath) {
                        // rule.$id is a bare path — match on path alone, preserve caller's origin
                        pathMatches = (pathBase !== null && pathBase === rule.basePath) ||
                                      url.pathname === rule.basePath;
                        targetPathname = rule.targetPath;
                    } else {
                        return null;
                    }

                    if (pathMatches) {
                        url.pathname = targetPathname;
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

/**
 * Recursively walk a JSON value, rewriting only the values of REFERENCE_PROPERTIES keys.
 */
export function replaceRefsInObject(
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

/**
 * Build rewrite rules from the *current on-disk* `$id` of every tracked document. Any reference to
 * a tracked document (bare id, stale versioned path, or full URL) is mapped to that document's
 * current `$id`. Documents without a usable `$id` are skipped as targets (they can still contain
 * references that get rewritten).
 */
export async function buildRefRulesFromDiskIds(
    manifest: WorkspaceManifest,
    bundlePath: string
): Promise<RefRule[]> {
    const rules: RefRule[] = [];
    for (const [id, entry] of Object.entries(manifest)) {
        const filePath = resolveFilePath(bundlePath, entry.path);
        if (!existsSync(filePath)) continue;
        try {
            const raw = await readFile(filePath, 'utf8');
            const json = JSON.parse(raw);
            const documentId = json?.['$id'];
            if (typeof documentId !== 'string' || !documentId.trim()) continue;
            rules.push({
                bareId: id,
                targetPath: documentId,
                basePath: stripVersionSuffix(documentId),
            });
        } catch {
            // unreadable / invalid JSON — cannot be a rule target
            continue;
        }
    }
    return rules;
}

/**
 * Rewrite references across all tracked documents according to the given rules, writing back any
 * file that changed. Idempotent: a second run finds references already at their target and is a
 * no-op.
 */
export async function syncReferences(
    bundlePath: string,
    manifest: WorkspaceManifest,
    rules: RefRule[]
): Promise<RefUpdateResult[]> {
    const results: RefUpdateResult[] = [];

    for (const [id, entry] of Object.entries(manifest)) {
        const filePath = resolveFilePath(bundlePath, entry.path);
        if (!existsSync(filePath)) {
            logger.warn(`File not found for '${id}': ${filePath}`);
            continue;
        }

        let json: unknown;
        try {
            json = JSON.parse(await readFile(filePath, 'utf8'));
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
            await writeFile(filePath, JSON.stringify(updated, null, 2), 'utf8');
        }

        results.push({ docId: id, filePath, changeCount: replacements.length });
    }

    return results;
}
