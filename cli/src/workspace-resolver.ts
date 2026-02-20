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
        if (existsSync(gitPath) && statSync(gitPath).isDirectory()) {
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

function findWorkspaceRoot(startPath?: string): string | null {
    const gitRoot = findGitRoot(startPath);
    if (!gitRoot) return null;
    const workspacePath = join(gitRoot, '.calm-workspace');
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
export function findWorkspaceBundlePath(startPath?: string): string | null {
    const fromEnv = resolveWorkspaceBundlePathFromEnv();
    if (fromEnv) return fromEnv;

    const workspaceRoot = findWorkspaceRoot(startPath);
    if (!workspaceRoot) return null;

    const workspaceName = getDefaultWorkspaceName(workspaceRoot);
    const bundlePath = join(workspaceRoot, 'bundles', workspaceName);
    if (existsSync(bundlePath) && statSync(bundlePath).isDirectory()) {
        return bundlePath;
    }
    return null;
}
