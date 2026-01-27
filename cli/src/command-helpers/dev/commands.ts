import { Command } from 'commander';
import path from 'path';
import { ensureWorkspaceBundle } from './workspace';
import { addFileToBundle } from './bundle';
import { findWorkspaceBundlePath } from '../../workspace-resolver';

export function setupDevCommands(program: Command) {
    const dev = program.command('dev').description('Development helpers for CALM');

    dev
        .command('workspace')
        .description('Manage CALM workspace in a repository')
        .option('--set <name>', 'Set the workspace name (creates bundles/<name> and workspace.json)')
        .option('--dir <path>', 'Directory in which to create the workspace (defaults to current directory)', '.')
        .action(async (options: { set?: string; dir?: string }) => {
            if (!options.set) {
                console.error('Please specify --set <name> to create or update the workspace.');
                process.exit(1);
            }

            const workspaceName: string = options.set as string;
            const targetDir = path.resolve(options.dir || '.');
            const calmWorkspacePath = path.join(targetDir, '.calm-workspace');
            const bundlesPath = path.join(calmWorkspacePath, 'bundles');
            const bundleDir = path.join(bundlesPath, workspaceName);

            try {
                const created = await ensureWorkspaceBundle(targetDir, workspaceName);
                console.log(`Workspace '${workspaceName}' created/updated at ${path.dirname(created)}`);
                console.log(`Bundle directory ensured at ${created}`);
            } catch (err) {
                console.error('Failed to create workspace: ' + (err instanceof Error ? err.message : String(err)));
                process.exit(1);
            }
        });

    // Add a file to the current workspace bundle
    dev
        .command('add')
        .description('Add a file to the current CALM workspace bundle')
        .argument('<file>', 'Path to the file to add to the bundle')
        .option('--id <id>', 'Document ID to register for this file (defaults to filename without extension)')
        .action(async (file: string, options: any) => {
            try {
                const bundlePath = findWorkspaceBundlePath(process.cwd());
                if (!bundlePath) {
                    console.error('No CALM workspace bundle found. Create one with `calm dev workspace --set <name>`');
                    process.exit(1);
                }

                const srcPath = path.resolve(file);

                // Delegate to bundle helper which does all FS operations
                const { id, destPath: finalDestPath } = await addFileToBundle(bundlePath, srcPath, { id: options && options.id ? options.id : undefined });
                console.log(`Added ${srcPath} -> ${finalDestPath} (id: ${id})`);
            } catch (err) {
                console.error('Failed to add file to workspace bundle: ' + (err instanceof Error ? err.message : String(err)));
                process.exit(1);
            }
        });
}
