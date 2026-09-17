import * as vscode from 'vscode';
import * as path from 'path';
import * as YAML from 'yaml';
import { parseRequirementSchema } from './requirement-parser';
import {
    isCanonicalControlUrl,
    isControlCurie,
    isLocalControlPath,
    makeControlMapKey,
    parseCanonicalControlUrl,
    parseControlCurie,
} from './control-curie';

export interface BuildingBlockDef {
    id: string;
    name: string;
    behaviour: string;
    controls: Record<string, unknown>;
    category?: string;
    nodeType?: string;
    /** Hub namespace — present when this block was fetched from a remote CalmHub. */
    namespace?: string;
    /** Content-addressable SHA — present when this block was fetched from a remote CalmHub. */
    sha?: string;
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

/** Deprecated inline `controls:` front-matter entry shape (pre-`control-refs`). */
export interface LegacyFrontMatterControl {
    id?: string;
    name?: string;
    description?: string;
    metadata?: unknown;
}

/**
 * Convert a standard/guideline's front-matter controls into the CALM control-map
 * shape. `refs` are the new `control-refs` entries (CURIE / canonical URL / local
 * path); `legacyControls` are deprecated inline `controls:` objects. Both are
 * passed explicitly so the merge is visible: legacy entries are converted first,
 * then ref-derived entries take precedence on key collision. Pure and exported
 * for unit testing.
 */
export function frontMatterControlsToMap(
    refs: string[],
    legacyControls: LegacyFrontMatterControl[],
    localControls: LocalControlDef[],
    legacyRequirementUrl = ''
): { controls: Record<string, unknown>; warnings: string[] } {
    const controls: Record<string, unknown> = {};
    const warnings: string[] = [];

    // Legacy inline controls first — ref-derived entries below take precedence.
    for (const raw of legacyControls) {
        if (!raw || typeof raw !== 'object') continue;
        const idVal =
            typeof raw.id === 'string'
                ? raw.id
                : typeof raw.name === 'string'
                  ? raw.name
                  : '';
        if (!idVal) continue;
        const entry: Record<string, unknown> = {
            description:
                (typeof raw.description === 'string' ? raw.description : undefined) ??
                (typeof raw.name === 'string' ? raw.name : ''),
            requirements: [{ 'requirement-url': legacyRequirementUrl, config: {} }],
        };
        if (raw.metadata && typeof raw.metadata === 'object') {
            entry.metadata = raw.metadata;
        }
        controls[idVal] = entry;
    }

    const refKeys = new Set<string>();
    for (const ref of refs) {
        if (typeof ref !== 'string' || !ref.trim()) continue;
        const key = makeControlMapKey(ref);
        if (refKeys.has(key)) {
            warnings.push(`Duplicate control ref key "${key}" — last wins`);
        }
        refKeys.add(key);

        if (isLocalControlPath(ref)) {
            const local = localControls.find((c) => c.relativePath === ref);
            if (!local) {
                warnings.push(`Local control not found for ref "${ref}"`);
                continue;
            }
            controls[key] = {
                description: local.description,
                requirements: [
                    {
                        'requirement-url': ref,
                        config: {
                            'control-id': local.controlId,
                            name: local.name,
                            description: local.description,
                        },
                    },
                ],
            };
        } else if (isCanonicalControlUrl(ref) || isControlCurie(ref)) {
            const parts = isCanonicalControlUrl(ref)
                ? parseCanonicalControlUrl(ref)
                : parseControlCurie(ref);
            if (!parts) {
                warnings.push(`Invalid control ref "${ref}"`);
                continue;
            }
            // Eagerly seed identity if a local control matches by slug,
            // regardless of domain — allows local dev against any domain.
            const local = localControls.find((c) => c.id === parts.controlName);
            if (local) {
                controls[key] = {
                    description: local.description,
                    requirements: [
                        {
                            'requirement-url': ref,
                            config: {
                                'control-id': local.controlId,
                                name: local.name,
                                description: local.description,
                            },
                        },
                    ],
                };
            } else {
                // Hub ref — identity resolved lazily by the webview.
                controls[key] = {
                    description: parts.controlName,
                    requirements: [{ 'requirement-url': ref, config: {} }],
                };
            }
        } else {
            warnings.push(`Unrecognized control ref "${ref}"`);
        }
    }

    return { controls, warnings };
}

export class WorkspaceAssetService {
    private buildingBlocks: BuildingBlockDef[] = [];
    private patterns: PatternEntry[] = [];
    private templates: CalmTemplate[] = [];
    private standards: StandardDef[] = [];
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
        // Controls must be scanned before building blocks, because
        // addStandardsPaletteItems() (invoked from scanBuildingBlocks) resolves
        // standard control-refs against the scanned local controls.
        await this.scanControls();
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
    getControls(): LocalControlDef[] {
        return this.controls;
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
     * controls onto the target node. Prefers `control-refs`; still parses the
     * deprecated inline `controls:` for one release.
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

            const refs = Array.isArray(fm['control-refs'])
                ? (fm['control-refs'] as unknown[]).filter(
                      (r): r is string => typeof r === 'string'
                  )
                : [];
            const legacy = Array.isArray(fm.controls)
                ? (fm.controls as LegacyFrontMatterControl[])
                : [];
            if (legacy.length > 0) {
                console.warn(
                    `[CALM] Deprecated inline 'controls:' in ${requirementUrl} — migrate to 'control-refs:'`
                );
            }

            const { controls, warnings } = frontMatterControlsToMap(
                refs,
                legacy,
                this.controls,
                requirementUrl
            );
            for (const w of warnings) {
                console.warn(`[CALM] ${requirementUrl}: ${w}`);
            }

            return {
                name: typeof fm.name === 'string' ? fm.name : undefined,
                controls,
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
        return base.replace(/\.(calm|architecture|template|solution|standard|guideline)\.json$/, '').replace(/\.md$/, '');
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
        if (requirementUrl.includes('..') || requirementUrl.startsWith('/') || /^[a-zA-Z]:/.test(requirementUrl)) {
            return null;
        }
        for (const root of this.getRoots()) {
            const uri = vscode.Uri.joinPath(root, requirementUrl);
            if (!uri.fsPath.startsWith(root.fsPath)) {
                continue;
            }
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
        for (const watcher of this.watchers) watcher.dispose();
        this.watchers = [];
    }
}
