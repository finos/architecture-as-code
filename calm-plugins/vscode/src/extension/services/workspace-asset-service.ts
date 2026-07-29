import * as vscode from 'vscode';
import * as path from 'path';
import * as YAML from 'yaml';

export interface BuildingBlockDef {
    id: string;
    name: string;
    behaviour: string;
    controls: Record<string, unknown>;
    category?: string;
    nodeType?: string;
}

export interface PatternEntry {
    id: string;
    name: string;
    description: string;
    category: string;
    schema: unknown;
}

export interface CalmTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    content: unknown;
}

export interface StandardDef {
    id: string;
    name: string;
    filePath: string;
}

/**
 * Convert a markdown front-matter `controls` array into the CALM control-map
 * shape used on nodes: `{ [id]: { description, requirements:[{requirement-url,config}], metadata } }`.
 * Pure and exported so it can be unit-tested without the VS Code API.
 */
export function frontMatterControlsToMap(
    controls: unknown,
    requirementUrl: string
): Record<string, unknown> {
    if (!Array.isArray(controls)) return {};
    const map: Record<string, unknown> = {};
    for (const raw of controls) {
        if (!raw || typeof raw !== 'object') continue;
        const ctrl = raw as Record<string, unknown>;
        const idVal =
            typeof ctrl.id === 'string'
                ? ctrl.id
                : typeof ctrl.name === 'string'
                  ? ctrl.name
                  : '';
        if (!idVal) continue;
        const entry: Record<string, unknown> = {
            description:
                (typeof ctrl.description === 'string'
                    ? ctrl.description
                    : undefined) ??
                (typeof ctrl.name === 'string' ? ctrl.name : ''),
            requirements: [{ 'requirement-url': requirementUrl, config: {} }],
        };
        if (ctrl.metadata && typeof ctrl.metadata === 'object') {
            entry.metadata = ctrl.metadata;
        }
        map[idVal] = entry;
    }
    return map;
}

export class WorkspaceAssetService {
    private buildingBlocks: BuildingBlockDef[] = [];
    private patterns: PatternEntry[] = [];
    private templates: CalmTemplate[] = [];
    private standards: StandardDef[] = [];
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
        await Promise.all([
            this.scanBuildingBlocks(),
            this.scanPatterns(),
            this.scanTemplates(),
            this.scanStandards(),
        ]);
    }

    getBuildingBlocks(): BuildingBlockDef[] {
        return this.buildingBlocks;
    }
    getPatterns(): PatternEntry[] {
        return this.patterns;
    }
    getTemplates(): CalmTemplate[] {
        return this.templates;
    }
    getStandards(): StandardDef[] {
        return this.standards;
    }

    registerWatchers(
        context: vscode.ExtensionContext,
        onRescan: () => void
    ): void {
        const globs = [
            'building-blocks/**/*.{calm.json,architecture.json}',
            'building-blocks/**/*.{calm.json,architecture.json}',
            'patterns/**/*.pattern.json',
            'templates/**/*.template.json',
            'standards/**/*.md',
            'guidelines/**/*.md',
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

    private async scanBuildingBlocks(): Promise<void> {
        const nodes: BuildingBlockDef[] = [];
        const seen = new Set<string>();
        const roots = this.getRoots();

        for (const root of roots) {
            const globs = [
                new vscode.RelativePattern(
                    root,
                    'building-blocks/**/*.{calm.json,architecture.json}'
                ),
                new vscode.RelativePattern(
                    root,
                    'building-blocks/**/*.{calm.json,architecture.json}'
                ),
            ];

            for (const pattern of globs) {
                const files = await vscode.workspace.findFiles(pattern);
                for (const file of files) {
                    try {
                        const content =
                            await vscode.workspace.fs.readFile(file);
                        const json = JSON.parse(
                            Buffer.from(content).toString('utf-8')
                        );
                        if (
                            json.nodes &&
                            Array.isArray(json.nodes) &&
                            json.nodes.length > 0
                        ) {
                            const node = json.nodes[0];
                            const metadata = (node.metadata ?? {}) as Record<
                                string,
                                unknown
                            >;
                            const id = this.stem(file);
                            if (seen.has(id)) continue;
                            seen.add(id);

                            const category =
                                this.extractCategory(file, 'building-blocks') ||
                                this.extractCategory(file, 'building-blocks') ||
                                'General';

                            nodes.push({
                                id,
                                name: node.name ?? id,
                                behaviour:
                                    metadata['building-block-behaviour'] ===
                                    'apply-controls-on-drop'
                                        ? 'apply-controls-on-drop'
                                        : 'create-node',
                                controls: node.controls ?? {},
                                category,
                                nodeType: node['node-type'] ?? 'system',
                            });
                        }
                    } catch {
                        /* skip invalid files */
                    }
                }
            }
        }

        // Also convert standards/guidelines markdown to palette items
        for (const root of roots) {
            await this.addStandardsPaletteItems(nodes, root, 'standards');
            await this.addStandardsPaletteItems(nodes, root, 'guidelines');
        }

        this.buildingBlocks = nodes;
    }

    private async addStandardsPaletteItems(
        nodes: BuildingBlockDef[],
        root: vscode.Uri,
        folder: 'standards' | 'guidelines'
    ): Promise<void> {
        const pattern = new vscode.RelativePattern(root, `${folder}/**/*.md`);
        const files = await vscode.workspace.findFiles(pattern);

        for (const file of files) {
            const stem = this.stem(file);
            if (stem === 'README') continue;
            const id = `${folder}:${stem}`;
            const category = this.extractCategory(file, folder) || 'General';
            const requirementUrl = this.toRelativeUrl(root, file);
            const fm = await this.readFrontMatter(file, requirementUrl);
            const name =
                fm?.name ??
                stem
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase());

            nodes.push({
                id,
                name,
                behaviour: 'apply-controls-on-drop',
                controls: fm?.controls ?? {},
                category,
                nodeType: 'standard',
            });
        }
    }

    /**
     * Parse a standard/guideline markdown's YAML front matter to extract its
     * display name and control definitions, so dropping it applies validatable
     * controls onto the target node.
     */
    private async readFrontMatter(
        file: vscode.Uri,
        requirementUrl: string
    ): Promise<{ name?: string; controls: Record<string, unknown> } | null> {
        try {
            const bytes = await vscode.workspace.fs.readFile(file);
            const text = Buffer.from(bytes).toString('utf-8');
            const match = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(text);
            if (!match) return null;
            const fm = YAML.parse(match[1]) as Record<string, unknown> | null;
            if (!fm || typeof fm !== 'object') return null;
            return {
                name: typeof fm.name === 'string' ? fm.name : undefined,
                controls: frontMatterControlsToMap(fm.controls, requirementUrl),
            };
        } catch {
            return null;
        }
    }

    private toRelativeUrl(root: vscode.Uri, file: vscode.Uri): string {
        return path
            .relative(root.fsPath, file.fsPath)
            .split(path.sep)
            .join('/');
    }

    private stem(uri: vscode.Uri): string {
        const base = path.basename(uri.fsPath);
        return base.replace(/\.calm\.json$/, '').replace(/\.md$/, '');
    }

    private extractCategory(uri: vscode.Uri, baseFolder: string): string {
        const parts = uri.path.split('/');
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

    private async scanTemplates(): Promise<void> {
        const templates: CalmTemplate[] = [];
        const seen = new Set<string>();

        for (const root of this.getRoots()) {
            const glob = new vscode.RelativePattern(
                root,
                'templates/**/*.template.json'
            );
            const files = await vscode.workspace.findFiles(glob);
            for (const file of files) {
                try {
                    const content = await vscode.workspace.fs.readFile(file);
                    const json = JSON.parse(
                        Buffer.from(content).toString('utf-8')
                    );
                    const meta = json._template ?? {};
                    const id = path
                        .basename(file.fsPath)
                        .replace(/\.template\.json$/, '');
                    if (seen.has(id)) continue;
                    seen.add(id);
                    templates.push({
                        id,
                        name: meta.name ?? id,
                        description: meta.description ?? '',
                        category: meta.category ?? 'general',
                        content: json,
                    });
                } catch {
                    /* skip invalid template files */
                }
            }
        }

        this.templates = templates;
    }

    private async scanStandards(): Promise<void> {
        const standards: StandardDef[] = [];
        const dirs = ['standards', 'guidelines'];

        for (const dir of dirs) {
            const dirPath = path.join(this.workspaceRoot, dir);
            try {
                const uri = vscode.Uri.file(dirPath);
                const entries = await vscode.workspace.fs.readDirectory(uri);
                for (const [name, type] of entries) {
                    if (type !== vscode.FileType.File || !name.endsWith('.md'))
                        continue;
                    standards.push({
                        id: name.replace('.md', ''),
                        name: name.replace('.md', '').replace(/-/g, ' '),
                        filePath: path.join(dirPath, name),
                    });
                }
            } catch {
                /* directory doesn't exist */
            }
        }

        this.standards = standards;
    }

    /**
     * Resolve the raw markdown prose for a standard/guideline referenced by a
     * control requirement URL (e.g. `standards/tls-policy.md`). Searches every
     * workspace root plus the configured external assets path.
     */
    async resolveStandardProse(requirementUrl: string): Promise<string | null> {
        for (const root of this.getRoots()) {
            const uri = vscode.Uri.joinPath(root, requirementUrl);
            try {
                const bytes = await vscode.workspace.fs.readFile(uri);
                return Buffer.from(bytes).toString('utf-8');
            } catch {
                /* try next root */
            }
        }
        return null;
    }

    dispose(): void {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
    }
}
