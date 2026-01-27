import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
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

    const workspaceJsonPath = path.join(calmWorkspacePath, 'workspace.json');
    const workspaceJson = { name: workspaceName };
    // Only write workspace.json if it doesn't exist or contains different name
    try {
        if (!existsSync(workspaceJsonPath)) {
            await writeFile(workspaceJsonPath, JSON.stringify(workspaceJson, null, 2), 'utf8');
        } else {
            // attempt to read and update if necessary — keep simple and overwrite
            await writeFile(workspaceJsonPath, JSON.stringify(workspaceJson, null, 2), 'utf8');
        }
    } catch (e) {
        // rethrow to allow caller to handle
        throw e;
    }

    return bundleDir;
}
