import { Command } from 'commander';
import path from 'path';
import { ensureWorkspaceBundle, getActiveWorkspace, listWorkspaces, setActiveWorkspace, cleanWorkspaceBundle, cleanAllWorkspaces } from './workspace';
import { addFileToBundle, addObjectToBundle, loadManifest, printBundleTree } from './bundle';
import { findWorkspaceBundlePath, findGitRoot } from '../../workspace-resolver';
import { buildDocumentLoader, DocumentLoader, DocumentLoaderOptions } from '../../../../shared/src/document-loader/document-loader';
import fs from 'fs';
import { JSONPath } from 'jsonpath-plus';
import { initLogger, Logger } from '@finos/calm-shared/src/logger';

const logger: Logger = initLogger(false, 'workspace');

async function loadJsonFile(filePath: string): Promise<any> {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

async function pullReferencesFromBundle(bundlePath: string, docLoader: DocumentLoader) {
    const manifest = await loadManifest(bundlePath);
    const processed = new Set<string>(Object.keys(manifest));
    const queue: string[] = Object.values(manifest).map(p => path.join(bundlePath, p));

    while (queue.length > 0) {
        const filePath = queue.shift()!;
        let json: any;
        try {
            json = await loadJsonFile(filePath);
        } catch (e) {
            logger.warn('Failed to parse JSON ' + filePath + ': ' + (e instanceof Error ? e.message : String(e)));
            continue;
        }

        // Use jsonpath-plus to extract all $ref values anywhere in the JSON
        const found = JSONPath({ path: "$..['$ref']", json }) as unknown[];
        const refs = new Set<string>(found.filter((v) => typeof v === 'string') as string[]);

        for (const ref of refs) {
            // skip if already in manifest (by id)
            // try to resolve via docLoader.resolvePath first
            if (!ref.startsWith('http')) {
                // local reference; skip
                continue;
            }
            const resolved = docLoader.resolvePath(ref);
            try {
                const loaded = await docLoader.loadMissingDocument(ref, 'schema').catch(async (e) => {
                    // if resolvePath returned a local file path, try loading from it directly
                    if (resolved) {
                        return await loadJsonFile(resolved);
                    }
                    throw e;
                });

                // loaded may be object; determine id
                const added = await addObjectToBundle(bundlePath, loaded);
                if (!processed.has(added.id)) {
                    processed.add(added.id);
                    queue.push(added.destPath);
                }
            } catch (e) {
                logger.warn(`Failed to load reference ${ref}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }
}

/**
 * Pull all referenced documents for a workspace bundle.
 *
 * This will:
 *  - locate the workspace bundle (if bundlePath not provided),
 *  - build a DocumentLoader from provided options (or defaults),
 *  - recursively load all documents referenced via $ref from files in the bundle,
 *    storing them in the bundle and updating the manifest. Already-registered
 *    document ids in the bundle manifest are not re-fetched.
 *
 * @param bundlePath Optional absolute path to the workspace bundle. If omitted the current
 *                   repository workspace bundle will be discovered.
 * @param docLoaderOpts Optional DocumentLoaderOptions to configure the document loader.
 */
export async function pullWorkspaceBundle(bundlePath?: string, docLoaderOpts?: DocumentLoaderOptions): Promise<void> {
    const bp = bundlePath || findWorkspaceBundlePath(process.cwd());
    if (!bp) {
        throw new Error('No CALM workspace bundle found.');
    }

    const opts: DocumentLoaderOptions = docLoaderOpts ?? {};
    const docLoader = buildDocumentLoader(opts);
    try {
        await docLoader.initialise(undefined as any);
    } catch (e) {
        // some loaders may not require initialise; ignore failures here
    }

    await pullReferencesFromBundle(bp, docLoader);
}

export function setupWorkspaceCommands(program: Command) {
    const workspaceCmd = program.command('workspace').description('Manage CALM workspace bundle and development helpers');

    workspaceCmd
        .command('init')
        .description('Initialize or update CALM workspace in a repository')
        .argument('<name>', 'The name of the workspace to create or update')
        .option('--dir <path>', 'Directory in which to create the workspace (defaults to git root)')
        .action(async (name: string, options: { dir?: string }) => {
            if (!name) {
                logger.error('Please specify the workspace name. Usage: calm workspace init <name> [--dir <path>]');
                process.exit(1);
            }

            const workspaceName: string = name as string;
            const targetDir = options.dir ? path.resolve(options.dir) : (findGitRoot(process.cwd()) ?? process.cwd());
            const calmWorkspacePath = path.join(targetDir, '.calm-workspace');
            const bundlesPath = path.join(calmWorkspacePath, 'bundles');
            const bundleDir = path.join(bundlesPath, workspaceName);

            try {
                const created = await ensureWorkspaceBundle(targetDir, workspaceName);
                logger.info(`Workspace '${workspaceName}' created/updated at ${path.dirname(created)}`);
                logger.info(`Bundle directory ensured at ${created}`);
            } catch (err) {
                logger.error('Failed to create workspace: ' + (err instanceof Error ? err.message : String(err)));
                process.exit(1);
            }
        });

    // Add a file to the current workspace bundle
    workspaceCmd
        .command('add')
        .description('Add a file to the current CALM workspace bundle. By default, this creates a reference to the file at its current location.')
        .argument('<file>', 'Path to the file to add to the bundle')
        .option('--id <id>', 'Document ID to register for this file (defaults to filename without extension)')
        .option('--copy', 'Copy the file into the bundle instead of referencing it from its current location.')
        .action(async (file: string, options: any) => {
            try {
                const bundlePath = findWorkspaceBundlePath(process.cwd());
                if (!bundlePath) {
                    logger.error('No CALM workspace bundle found. Create one with `calm workspace init <name>`');
                    process.exit(1);
                }

                const srcPath = path.resolve(file);

                // Delegate to bundle helper which does all FS operations
                const { id, destPath: finalDestPath } = await addFileToBundle(bundlePath, srcPath, {
                    id: options.id,
                    copy: options.copy
                });

                if (options.copy) {
                    logger.info(`Copied ${srcPath} -> ${finalDestPath} (id: ${id})`);
                } else {
                    logger.info(`Added reference to ${finalDestPath} (id: ${id})`);
                }
            } catch (err) {
                logger.error('Failed to add file to workspace bundle: ' + (err instanceof Error ? err.message : String(err)));
                process.exit(1);
            }
        });

    // Add pull command
    workspaceCmd
        .command('pull')
        .description('Pull referenced documents for all files in the current workspace bundle')
        .option('--verbose', 'Show verbose logging from document loaders')
        .action(async (options: { verbose?: boolean }) => {
            try {
                await pullWorkspaceBundle(undefined, { debug: options.verbose ?? false });
                logger.info('Pull complete');
            } catch (err) {
                logger.error('Failed to pull references: ' + (err instanceof Error ? err.message : String(err)));
                process.exit(1);
            }
        });

    // Add tree command
    workspaceCmd
        .command('tree')
        .description('Print dependency tree of files in the current workspace bundle')
        .action(async () => {
            try {
                const bundlePath = findWorkspaceBundlePath(process.cwd());
                if (!bundlePath) {
                    logger.error('No CALM workspace bundle found.');
                    process.exit(1);
                }
                await printBundleTree(bundlePath);
            } catch (err) {
                logger.error('Failed to print tree: ' + (err instanceof Error ? err.message : String(err)));
                process.exit(1);
            }
        });

    // Add list command
    workspaceCmd
        .command('list')
        .description('List all available workspaces')
        .action(async () => {
            try {
                const gitRoot = findGitRoot(process.cwd());
                if (!gitRoot) {
                    logger.error('No git repository found. Please run this command from within a git repository.');
                    process.exit(1);
                }
                const workspaces = await listWorkspaces(gitRoot);
                const activeWorkspace = await getActiveWorkspace(gitRoot);
                if (workspaces.length === 0) {
                    logger.warn('No workspaces found.');
                    return;
                }
                logger.info('Available workspaces:');
                for (const ws of workspaces) {
                    if (ws === activeWorkspace) {
                        logger.info(`* ${ws}`);
                    } else {
                        logger.info(`  ${ws}`);
                    }
                }
            } catch (err) {
                logger.error('Failed to list workspaces: ' + (err instanceof Error ? err.message : String(err)));
                process.exit(1);
            }
        });

    // Add show command
    workspaceCmd
        .command('show')
        .description('Show the active workspace')
        .action(async () => {
            try {
                const gitRoot = findGitRoot(process.cwd());
                if (!gitRoot) {
                    logger.error('No git repository found. Please run this command from within a git repository.');
                    process.exit(1);
                }
                const activeWorkspace = await getActiveWorkspace(gitRoot);
                if (activeWorkspace) {
                    logger.info(activeWorkspace);
                } else {
                    logger.info('No active workspace.');
                }
            } catch (err) {
                logger.error('Failed to get active workspace: ' + (err instanceof Error ? err.message : String(err)));
                process.exit(1);
            }
        });

    // Add switch command
    workspaceCmd
        .command('switch')
        .description('Switch the active workspace')
        .argument('<name>', 'The name of the workspace to switch to')
        .action(async (name: string) => {
            try {
                const gitRoot = findGitRoot(process.cwd());
                if (!gitRoot) {
                    logger.error('No git repository found. Please run this command from within a git repository.');
                    process.exit(1);
                }
                const workspaces = await listWorkspaces(gitRoot);
                if (!workspaces.includes(name)) {
                    logger.error(`Workspace '${name}' not found.`);
                    process.exit(1);
                }
                await setActiveWorkspace(gitRoot, name);
                logger.info(`Switched to workspace '${name}'.`);
            } catch (err) {
                logger.error('Failed to switch workspace: ' + (err instanceof Error ? err.message : String(err)));
                process.exit(1);
            }
        });

    // Add clean command
    workspaceCmd
        .command('clean')
        .description('Clean the active workspace bundle (use --all to clean all workspaces)')
        .option('--all', 'Clean all workspaces and reset workspace.json')
        .action(async (options: { all?: boolean }) => {
            try {
                const gitRoot = findGitRoot(process.cwd());
                if (!gitRoot) {
                    logger.error('No git repository found. Please run this command from within a git repository.');
                    process.exit(1);
                }

                if (options.all) {
                    await cleanAllWorkspaces(gitRoot);
                    logger.info('All workspaces cleaned.');
                } else {
                    const activeWorkspace = await getActiveWorkspace(gitRoot);
                    if (!activeWorkspace) {
                        logger.error('No active workspace. Use --all to clean all workspaces.');
                        process.exit(1);
                    }
                    await cleanWorkspaceBundle(gitRoot, activeWorkspace);
                    logger.info(`Workspace '${activeWorkspace}' cleaned.`);
                }
            } catch (err) {
                logger.error('Failed to clean workspace: ' + (err instanceof Error ? err.message : String(err)));
                process.exit(1);
            }
        });
}
