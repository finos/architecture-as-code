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
 * Resolve the root directory workspace state should live under: the git root if one
 * exists, otherwise startPath (or the cwd) itself. This lets workspaces be used from
 * folders that aren't git repositories, without walking further up the filesystem
 * when there's no git boundary to stop at.
 */
export function findProjectRoot(startPath?: string): string {
    const resolvedStart = startPath || process.cwd();
    return findGitRoot(resolvedStart) ?? resolvedStart;
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
