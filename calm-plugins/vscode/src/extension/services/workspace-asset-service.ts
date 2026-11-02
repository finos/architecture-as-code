import * as vscode from 'vscode';
import * as path from 'path';
import { parseRequirementSchema } from './requirement-parser';

export interface StandardNodeDef {
    id: string;
    name: string;
    description?: string;
    controls: Record<string, unknown>;
    defaultNode?: Record<string, unknown>;
    category?: string;
    nodeType?: string;
    /** Hub namespace — present when this node was fetched from a remote CalmHub. */
    namespace?: string;
    /** Latest version string — present when this node was fetched from a remote CalmHub. */
    sha?: string;
    /** Hub numeric resource ID — used for API calls that require integer IDs. */
    hubId?: number;
}

/** A locally-authored standalone control requirement discovered under `controls/`. */
export interface LocalControlDef {
    /** File stem, e.g. "micro-segmentation". */
    id: string;
    /** `properties.control-id.const` from the requirement schema. */
    controlId: string;
    /** `properties.name.const`. */
    name: string;
    /** `properties.description.const`. */
    description: string;
    /** Absolute path on disk. */
    filePath: string;
    /** Normalized workspace-relative path — used for local file resolution. */
    relativePath: string;
    /** Domain derived from the first subdirectory under `controls/`, if any. */
    domain?: string;
}

export interface PatternEntry {
    id: string;
    name: string;
    description: string;
    category: string;
    schema: unknown;
    sha?: string;
}

export class WorkspaceAssetService {
    private standardNodes: StandardNodeDef[] = [];
    private patterns: PatternEntry[] = [];
    private controls: LocalControlDef[] = [];
    private watchers: vscode.FileSystemWatcher[] = [];
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly workspaceRoot: string) {}

    private getRoots(): vscode.Uri[] {
        const roots: vscode.Uri[] = [];
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            roots.push(folder.uri);
        }
        const externalPath = vscode.workspace
            .getConfiguration('calm')
            .get<string>('externalAssetsPath');
        if (externalPath?.trim()) {
            roots.push(vscode.Uri.file(externalPath.trim()));
        }
        return roots;
    }

    async scanAll(): Promise<void> {
        // Controls must be scanned before standard nodes so that
        // control-ref resolution can use the scanned local controls.
        await this.scanControls();
        await Promise.all([
            this.scanStandardNodes(),
            this.scanPatterns(),
        ]);
    }

    getStandardNodes(): StandardNodeDef[] {
        return this.standardNodes;
    }
    getPatterns(): PatternEntry[] {
        return this.patterns;
    }
    getControls(): LocalControlDef[] {
        return this.controls;
    }

    registerWatchers(
        context: vscode.ExtensionContext,
        onRescan: () => void
    ): void {
        const globs = [
            'standards/**/*.json',
            'patterns/**/*.pattern.json',
            'controls/**/*.json',
        ];

        const roots = this.getRoots();
        for (const root of roots) {
            for (const glob of globs) {
                const watcher = vscode.workspace.createFileSystemWatcher(
                    new vscode.RelativePattern(root, glob)
                );
                watcher.onDidChange(() => this.debouncedRescan(onRescan));
                watcher.onDidCreate(() => this.debouncedRescan(onRescan));
                watcher.onDidDelete(() => this.debouncedRescan(onRescan));
                this.watchers.push(watcher);
                context.subscriptions.push(watcher);
            }
        }
    }

    private debouncedRescan(onRescan: () => void): void {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(async () => {
            await this.scanAll();
            onRescan();
        }, 500);
    }

    private async scanControls(): Promise<void> {
        const controls: LocalControlDef[] = [];
        const seen = new Set<string>();

        for (const root of this.getRoots()) {
            // Any `controls/**/*.json` is considered; parseRequirementSchema
            // below skips files that aren't valid control requirements.
            const glob = new vscode.RelativePattern(
                root,
                'controls/**/*.json'
            );
            const files = await vscode.workspace.findFiles(glob);
            for (const file of files) {
                const relativePath = this.toRelativeUrl(root, file);
                // Multi-root: the first root to yield a given relative path wins.
                if (seen.has(relativePath)) continue;
                try {
                    const bytes = await vscode.workspace.fs.readFile(file);
                    const schema = JSON.parse(
                        Buffer.from(bytes).toString('utf-8')
                    );
                    const id = path
                        .basename(file.fsPath)
                        .replace(/(\.requirement)?\.json$/, '');
                    const title = typeof schema.title === 'string' ? schema.title : id;
                    const desc = typeof schema.description === 'string' ? schema.description : id;
                    const fallbackIdentity = { controlId: id, name: title, description: desc };
                    const { parsed } = parseRequirementSchema(schema, fallbackIdentity);
                    if (!parsed) continue;
                    seen.add(relativePath);
                    // Derive domain from subdirectory: controls/{domain}/{name}.json
                    const segments = relativePath.replace(/\\/g, '/').split('/');
                    const domain = segments[0] === 'controls' && segments.length > 2
                        ? segments[1]
                        : undefined;
                    controls.push({
                        id,
                        controlId: parsed.identity.controlId,
                        name: parsed.identity.name,
                        description: parsed.identity.description,
                        filePath: file.fsPath,
                        relativePath,
                        domain,
                    });
                } catch {
                    /* skip malformed requirement files */
                }
            }
        }

        this.controls = controls;
    }

    private async scanStandardNodes(): Promise<void> {
        const nodes: StandardNodeDef[] = [];
        const seen = new Set<string>();
        const roots = this.getRoots();

        for (const root of roots) {
            const pattern = new vscode.RelativePattern(
                root,
                'standards/**/*.json'
            );
            const files = await vscode.workspace.findFiles(pattern);
            for (const file of files) {
                try {
                    const content = await vscode.workspace.fs.readFile(file);
                    const json = JSON.parse(
                        Buffer.from(content).toString('utf-8')
                    );
                    const defaultNode =
                        json.default &&
                        typeof json.default === 'object' &&
                        !Array.isArray(json.default)
                            ? (json.default as Record<string, unknown>)
                            : undefined;
                    const extendsNodeSchema =
                        Array.isArray(json.allOf) &&
                        json.allOf.some(
                            (entry: unknown) =>
                                typeof (entry as { $ref?: unknown })?.$ref ===
                                    'string' &&
                                ((entry as { $ref: string }).$ref.endsWith(
                                    '/core.json#/defs/node'
                                ) ||
                                    (entry as { $ref: string }).$ref.endsWith(
                                        'core.json#/$defs/node'
                                    ))
                        );
                    if (!defaultNode && !extendsNodeSchema) continue;

                    const id = this.stem(file);
                    if (seen.has(id)) continue;
                    seen.add(id);

                    const category =
                        this.extractCategory(file, 'standards') || 'General';
                    const name =
                        (defaultNode?.name as string) ??
                        (typeof json.title === 'string'
                            ? json.title
                            : undefined) ??
                        id;
                    const description =
                        (defaultNode?.description as string) ??
                        (typeof json.description === 'string'
                            ? json.description
                            : undefined);
                    const controls =
                        defaultNode?.controls &&
                        typeof defaultNode.controls === 'object' &&
                        !Array.isArray(defaultNode.controls)
                            ? (defaultNode.controls as Record<string, unknown>)
                            : {};
                    const nodeType =
                        (defaultNode?.['node-type'] as string) ?? 'system';

                    nodes.push({
                        id,
                        name,
                        ...(description !== undefined ? { description } : {}),
                        controls,
                        ...(defaultNode ? { defaultNode } : {}),
                        category,
                        nodeType,
                    });
                } catch {
                    /* skip invalid files */
                }
            }
        }

        this.standardNodes = nodes;
    }

    private toRelativeUrl(root: vscode.Uri, file: vscode.Uri): string {
        return path
            .relative(root.fsPath, file.fsPath)
            .split(path.sep)
            .join('/');
    }

    private stem(uri: vscode.Uri): string {
        const base = path.basename(uri.fsPath);
        return base.replace(/(\.standard)?\.json$/, '');
    }

    private extractCategory(uri: vscode.Uri, baseFolder: string): string {
        const parts = (uri.path ?? uri.fsPath).replace(/\\/g, '/').split('/');
        const baseIdx = parts.findIndex((p) => p === baseFolder);
        if (baseIdx >= 0 && baseIdx + 1 < parts.length - 1) {
            return parts[baseIdx + 1]
                .replace(/-/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase());
        }
        return '';
    }

    private async scanPatterns(): Promise<void> {
        const patterns: PatternEntry[] = [];
        const seen = new Set<string>();

        for (const root of this.getRoots()) {
            const glob = new vscode.RelativePattern(
                root,
                'patterns/**/*.pattern.json'
            );
            const files = await vscode.workspace.findFiles(glob);
            for (const file of files) {
                try {
                    const content = await vscode.workspace.fs.readFile(file);
                    const json = JSON.parse(
                        Buffer.from(content).toString('utf-8')
                    );
                    const id = path
                        .basename(file.fsPath)
                        .replace(/\.pattern\.json$/, '');
                    if (seen.has(id)) continue;
                    seen.add(id);
                    patterns.push({
                        id,
                        name: json.title ?? id,
                        description: json.description ?? '',
                        category:
                            json.category ?? json['x-category'] ?? 'general',
                        schema: json,
                    });
                } catch {
                    /* skip invalid pattern files */
                }
            }
        }

        this.patterns = patterns;
    }

    dispose(): void {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        for (const watcher of this.watchers) watcher.dispose();
        this.watchers = [];
    }
}
