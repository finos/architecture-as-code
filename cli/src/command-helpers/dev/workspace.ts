import path from 'path';
import { mkdir, writeFile, readdir, readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Ensure the workspace bundle exists at the given target directory and workspace name.
 * Creates .calm-workspace/bundles/<workspaceName> and writes workspace.json.
 * Returns the absolute path to the bundle directory.
 */
export async function ensureWorkspaceBundle(targetDir: string, workspaceName: string): Promise<string> {
    const calmWorkspacePath = path.join(targetDir, '.calm-workspace');
    const bundlesPath = path.join(calmWorkspacePath, 'bundles');
    const bundleDir = path.join(bundlesPath, workspaceName);

    await mkdir(bundleDir, { recursive: true });

    await setActiveWorkspace(targetDir, workspaceName);

    return bundleDir;
}

export async function getActiveWorkspace(targetDir: string): Promise<string | null> {
    const workspaceJsonPath = path.join(targetDir, '.calm-workspace', 'workspace.json');
    if (!existsSync(workspaceJsonPath)) {
        return null;
    }
    const content = await readFile(workspaceJsonPath, 'utf8');
    const json = JSON.parse(content);
    return json.name;
}

export async function listWorkspaces(targetDir: string): Promise<string[]> {
    const bundlesPath = path.join(targetDir, '.calm-workspace', 'bundles');
    if (!existsSync(bundlesPath)) {
        return [];
    }
    const entries = await readdir(bundlesPath, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
}

export async function setActiveWorkspace(targetDir: string, workspaceName: string): Promise<void> {
    const calmWorkspacePath = path.join(targetDir, '.calm-workspace');
    const workspaceJsonPath = path.join(calmWorkspacePath, 'workspace.json');
    const workspaceJson = { name: workspaceName };
    await writeFile(workspaceJsonPath, JSON.stringify(workspaceJson, null, 2), 'utf8');
}

/**
 * Clean a specific workspace bundle by deleting its directory.
 * Does not modify workspace.json (active workspace setting).
 */
export async function cleanWorkspaceBundle(targetDir: string, workspaceName: string): Promise<void> {
    const bundlePath = path.join(targetDir, '.calm-workspace', 'bundles', workspaceName);
    if (existsSync(bundlePath)) {
        await rm(path.join(bundlePath, '*'), { recursive: true, force: true });
        // wipe manifest
        await writeFile(path.join(bundlePath, 'bundle-manifest.json'), '{}', 'utf8');
    }
}

/**
 * Clean all workspace bundles and reset workspace.json.
 */
export async function cleanAllWorkspaces(targetDir: string): Promise<void> {
    const calmWorkspacePath = path.join(targetDir, '.calm-workspace');
    const bundlesPath = path.join(calmWorkspacePath, 'bundles');
    const workspaceJsonPath = path.join(calmWorkspacePath, 'workspace.json');

    // Delete all bundle files
    if (existsSync(bundlesPath)) {
        for (const file of await readdir(bundlesPath)) {
            await rm(path.join(bundlesPath, file), { recursive: true, force: true });
        }
    }

    // Reset the bundle manifest
    if (existsSync(workspaceJsonPath)) {
        await writeFile(workspaceJsonPath, JSON.stringify({}, null, 2), 'utf8');
    }
}