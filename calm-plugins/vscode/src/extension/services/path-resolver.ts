import * as fs from 'fs';
import * as path from 'path';

// Containment-checked resolution of workspace-relative asset paths. Extracted so
// the same rules apply to reads (drill/resolve) and writes (control save), and so
// the logic can be unit-tested without the VS Code API.

function isUnsafeRelative(relativePath: string): boolean {
    if (!relativePath) return true;
    if (relativePath.includes('..')) return true;
    // Reject absolute POSIX and Windows (drive-letter / UNC) paths.
    if (relativePath.startsWith('/') || relativePath.startsWith('\\')) return true;
    if (/^[a-zA-Z]:[\\/]/.test(relativePath)) return true;
    return false;
}

/** Real-path a directory to defeat symlink escape; falls back to the lexical path. */
function realpathDir(p: string): string {
    try {
        return fs.realpathSync(p);
    } catch {
        return p;
    }
}

function isContained(candidate: string, root: string): boolean {
    const realRoot = realpathDir(root);
    // Resolve the parent (which must exist) so a not-yet-created file still checks
    // out; the leaf name is appended back afterwards.
    const parent = realpathDir(path.dirname(candidate));
    const resolved = path.join(parent, path.basename(candidate));
    return resolved === realRoot || resolved.startsWith(realRoot + path.sep);
}

/**
 * Resolve a workspace-relative path against a list of roots (in order), then an
 * optional external assets path. Returns the first existing, contained match, or
 * `null` if none resolve safely.
 */
export function resolveLocalPath(
    relativePath: string,
    workspaceRoots: string[],
    externalAssetsPath?: string
): string | null {
    if (isUnsafeRelative(relativePath)) return null;

    const roots = [...workspaceRoots];
    if (externalAssetsPath?.trim()) roots.push(externalAssetsPath.trim());

    for (const root of roots) {
        const candidate = path.resolve(root, relativePath);
        if (!isContained(candidate, root)) continue;
        try {
            if (fs.statSync(candidate).isFile()) return candidate;
        } catch {
            /* try next root */
        }
    }
    return null;
}

/**
 * Resolve a safe write target for a new file inside `targetRoot`. Validates that
 * the parent directory exists and is contained within the root. Returns the full
 * write path, or `null` if the path is unsafe or the parent is missing.
 */
export function resolveSafeWritePath(
    relativePath: string,
    targetRoot: string
): string | null {
    if (isUnsafeRelative(relativePath)) return null;

    const candidate = path.resolve(targetRoot, relativePath);
    if (!isContained(candidate, targetRoot)) return null;

    const parent = path.dirname(candidate);
    try {
        if (!fs.statSync(parent).isDirectory()) return null;
    } catch {
        return null;
    }
    return candidate;
}
