import { existsSync, readFileSync, statSync } from 'fs';
import { dirname, join } from 'path';

// Resolve from environment variable if set
export function resolveWorkspaceBundlePathFromEnv(): string | null {
    const envPath = process.env.CALM_WORKSPACE_BUNDLE;
    if (envPath && existsSync(envPath) && statSync(envPath).isDirectory()) {
        return envPath;
    }
    return null;
}

export function findGitRoot(startPath?: string): string | null {
    let currentPath = startPath || process.cwd();
    while (true) {
        const gitPath = join(currentPath, '.git');
        // for regular git, this will be a folder. for worktrees, this will be a file.
        if (existsSync(gitPath)) {
            return currentPath;
        }
        const parentPath = dirname(currentPath);
        if (parentPath === currentPath) {
            break;
        }
        currentPath = parentPath;
    }
    return null;
}

/**
 * Walk upward from startPath looking for an existing `.calm-workspace` directory,
 * stopping at the nearest one found. The search never goes past gitBoundary (inclusive)
 * — without that limit, a workspace could be "found" in a wholly unrelated ancestor
 * project once the walk crosses out of the current git repo. When gitBoundary is null
 * (no git repo above startPath at all), the walk goes all the way to the filesystem root,
 * same as findGitRoot.
 */
function findExistingWorkspaceRoot(startPath: string, gitBoundary: string | null): string | null {
    let currentPath = startPath;
    while (true) {
        const workspacePath = join(currentPath, '.calm-workspace');
        if (existsSync(workspacePath) && statSync(workspacePath).isDirectory()) {
            return currentPath;
        }
        if (gitBoundary !== null && currentPath === gitBoundary) {
            break;
        }
        const parentPath = dirname(currentPath);
        if (parentPath === currentPath) {
            break;
        }
        currentPath = parentPath;
    }
    return null;
}

/**
 * Resolve the root directory workspace state should live under.
 *
 * Prefers the nearest ancestor — no further than the current git root, if there is one —
 * that already has a `.calm-workspace` directory, so a workspace created outside any git
 * repo stays reachable even if a `.git` later shows up further up the tree (otherwise
 * findGitRoot would start resolving to that new, higher root and the original workspace
 * would look like it had disappeared). Falls back to the git root, and finally to
 * startPath (or the cwd) itself — which lets workspaces be used from folders that aren't
 * git repositories at all.
 */
export function findProjectRoot(startPath?: string): string {
    const resolvedStart = startPath || process.cwd();
    const gitRoot = findGitRoot(resolvedStart);
    return findExistingWorkspaceRoot(resolvedStart, gitRoot) ?? gitRoot ?? resolvedStart;
}

function findWorkspaceRoot(startPath?: string): string | null {
    const projectRoot = findProjectRoot(startPath);
    const workspacePath = join(projectRoot, '.calm-workspace');
    if (existsSync(workspacePath) && statSync(workspacePath).isDirectory()) {
        return workspacePath;
    }
    return null;
}

function getDefaultWorkspaceName(workspaceRoot: string): string {
    const configPath = join(workspaceRoot, 'workspace.json');
    if (existsSync(configPath)) {
        try {
            const content = readFileSync(configPath, 'utf-8');
            const config = JSON.parse(content);
            if (config && typeof config.name === 'string') {
                return config.name;
            }
        } catch (_) {
            // ignore and fallback
        }
    }
    return 'default';
}

// Public resolver: try env var, then workspace config under git root
export function findWorkspaceManifestPath(startPath?: string): string | null {
    const fromEnv = resolveWorkspaceBundlePathFromEnv();
    if (fromEnv) return fromEnv;

    const workspaceRoot = findWorkspaceRoot(startPath);
    if (!workspaceRoot) return null;

    const workspaceName = getDefaultWorkspaceName(workspaceRoot);
    const manifestPath = join(workspaceRoot, 'bundles', workspaceName);
    if (existsSync(manifestPath) && statSync(manifestPath).isDirectory()) {
        return manifestPath;
    }
    return null;
}
