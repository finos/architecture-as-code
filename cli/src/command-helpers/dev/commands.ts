import { Command } from 'commander';
import path from 'path';
import { ensureWorkspaceBundle } from './workspace';
import { addFileToBundle, addObjectToBundle, loadManifest } from './bundle';
import { findWorkspaceBundlePath } from '../../workspace-resolver';
import { buildDocumentLoader, DocumentLoader, DocumentLoaderOptions } from '../../../../shared/src/document-loader/document-loader';
import fs from 'fs';
import { JSONPath } from 'jsonpath-plus';

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
            console.warn('Failed to parse JSON ' + filePath + ': ' + (e instanceof Error ? e.message : String(e)));
            continue;
        }

        // Use jsonpath-plus to extract all $ref values anywhere in the JSON
        const found = JSONPath({ path: "$..['$ref']", json }) as unknown[];
        const refs = new Set<string>(found.filter((v) => typeof v === 'string') as string[]);

        for (const ref of refs) {
            // skip if already in manifest (by id)
            // try to resolve via docLoader.resolvePath first
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
                console.warn(`Failed to load reference ${ref}: ${e instanceof Error ? e.message : String(e)}`);
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

    // Add pull command
    dev
        .command('pull')
        .description('Pull referenced documents for all files in the current workspace bundle')
        .action(async () => {
            try {
                await pullWorkspaceBundle();
                console.log('Pull complete');
            } catch (err) {
                console.error('Failed to pull references: ' + (err instanceof Error ? err.message : String(err)));
                process.exit(1);
            }
        });
}
