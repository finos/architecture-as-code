import { existsSync, readFileSync, statSync } from 'fs';
import { dirname, join } from 'path';

function findGitRoot(startPath?: string): string | null {
    const found = false;
    let currentPath = startPath;
    if (!currentPath) {
        currentPath = process.cwd();
    }
    while (!found) {
        const gitPath = join(currentPath, '.git');
        if (existsSync(gitPath) && statSync(gitPath).isDirectory()) {
            return currentPath;
        }
        const parentPath = dirname(currentPath);
        if (parentPath === currentPath) {
            // Reached filesystem root
            break;
        }
        currentPath = parentPath;
    }
    return null;
}

// TODO logging
function findWorkspaceRoot(startPath?: string): string | null {
    const gitRoot = findGitRoot(startPath);
    if (!gitRoot) {
        return null;
    }
    const workspacePath = join(gitRoot, '.calm-workspace');
    if (existsSync(workspacePath) && statSync(workspacePath).isDirectory()) {
        return workspacePath;
    }
    return null;
}

export function findWorkspaceBundlePath(startPath?: string): string | null {
    const workspaceRoot = findWorkspaceRoot(startPath);
    if (!workspaceRoot) {
        return null;
    }
    const workspacename = getDefaultWorkspaceName(workspaceRoot);
    const workspaceBundlePath = join(workspaceRoot, 'bundles', workspacename);
    return workspaceBundlePath;
}

export function getDefaultWorkspaceName(workspaceBundlePath: string): string {
    const configPath = join(workspaceBundlePath, 'workspace.json');
    if (existsSync(configPath)) {
        const configContent = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        if (config.name && typeof config.name === 'string') {
            return config.name;
        }
    }
    return 'default';
}