import { Argument, Command } from 'commander';
import path from 'path';
import { ensureWorkspaceBundle, getActiveWorkspace, listWorkspaces, setActiveWorkspace, cleanWorkspaceBundle, cleanAllWorkspaces } from './workspace';
import { addFileToBundle, printBundleTree, BundleDocumentType } from './bundle';
import { populateWorkspaceBundle } from './populate';
import { createNewDocument } from './new';
import { findWorkspaceBundlePath, findGitRoot } from '../../workspace-resolver';
import { initLogger, Logger } from '@finos/calm-shared/src/logger';
import { select, input } from '@inquirer/prompts';
import { CALM_DOCUMENT_TYPES_LIST } from '@finos/calm-shared/src/document-loader/document-loader';

const logger: Logger = initLogger(false, 'workspace');

/**
 * Sets up the 'workspace' command and its subcommands in the CLI.
 * @param program The Commander.js top-level program.
 */
export function setupWorkspaceCommands(program: Command) {
    const workspaceCmd = program.command('workspace').description('Manage CALM workspace bundle and development helpers');

    workspaceCmd
        .command('init')
        .description('Initialize or update CALM workspace in a repository')
        .argument('<name>', 'The name of the workspace to create or update')
        .option('--dir <path>', 'Directory in which to create the workspace (defaults to git root)')
        .action(async (name: string, options: { dir?: string }) => {
            const workspaceName: string = name as string;
            const targetDir = options.dir ? path.resolve(options.dir) : (findGitRoot(process.cwd()) ?? process.cwd());

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
        .option('--type <type>', 'Document type: architecture, pattern, schema, interface, timeline (defaults to unknown)')
        .action(async (file: string, options: { id?: string; copy?: boolean; type?: string }) => {
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
                    copy: options.copy,
                    type: options.type as BundleDocumentType | undefined
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

    workspaceCmd
        .command('populate')
        .description('Look at currently-tracked documents and add referenced files to the current workspace.')
        .option('--verbose', 'Show verbose logging from document loaders')
        .action(async (options: { verbose?: boolean }) => {
            try {
                await populateWorkspaceBundle(undefined, { debug: options.verbose ?? false });
                logger.info('Populate complete');
            } catch (err) {
                logger.error('Failed to populate references: ' + (err instanceof Error ? err.message : String(err)));
                process.exit(1);
            }
        });

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

    workspaceCmd
        .command('new')
        .description('Add a new document based on a template and track it in the current workspace.')
        .addArgument(new Argument('[type]', 'The type of document to create.')
            .choices(CALM_DOCUMENT_TYPES_LIST))
        .argument('namespace')
        .argument('name')
        .action(async (type, namespace, name) => {
            try {
                type = await enforceOptionPresenceByPrompt(type, 'Select a document type:', CALM_DOCUMENT_TYPES_LIST);
                namespace = await enforceOptionPresenceByPrompt(namespace, 'Enter the namespace for your new document:');
                name = await enforceOptionPresenceByPrompt(name, `Enter the name for your new ${type} document:`);

                const bundlePath = findWorkspaceBundlePath(process.cwd());
                if (!bundlePath) {
                    logger.error('No CALM workspace bundle found. Create one with `calm workspace init <name>`');
                    process.exit(1);
                }

                const filePath = await createNewDocument(namespace, name, type);
                await addFileToBundle(bundlePath, filePath, { type: type as BundleDocumentType });

                logger.info(`Created ${filePath}`);
            } catch (err) {
                logger.error('Failed to create document: ' + (err instanceof Error ? err.message : String(err)));
                process.exit(1);
            }
        });
}

async function enforceOptionPresenceByPrompt(cliInput: string | undefined, prompt: string, choices?: string[]): Promise<string> {
    if (cliInput) {
        // if it was selected already, just use that 
        return cliInput;
    }
    if (choices) {
        return await select({
            message: prompt,
            choices: choices.map((p: string) => ({ name: p, value: p }))
        })
    }
    return await input({
        message: prompt
    })
};