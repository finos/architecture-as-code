import * as vscode from 'vscode';
import * as path from 'path';
import type { PackDefinition } from '../../packs/types';
import {
    loadPacksFromDirectories,
    orderedPackDirectories,
} from '../../packs/json/loadPacksFromFs';

export class PackLoaderService implements vscode.Disposable {
    private watchers: vscode.FileSystemWatcher[] = [];
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private packs: PackDefinition[] = [];

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly log: vscode.OutputChannel
    ) {}

    getPacks(): PackDefinition[] {
        return this.packs;
    }

    load(): PackDefinition[] {
        const workspaceFolders = (vscode.workspace.workspaceFolders ?? []).map(
            (f) => f.uri.fsPath
        );
        const calmConfig = vscode.workspace.getConfiguration('calm');
        const extraFolders = (calmConfig.get<string[]>('packs.folders', []) ?? []).map(
            (folder) => this.resolveFolder(folder, workspaceFolders)
        );
        const dirs = orderedPackDirectories({
            fallbackDir: vscode.Uri.joinPath(
                this.context.extensionUri,
                'dist',
                'extensions',
                'packs'
            ).fsPath,
            workspaceFolders,
            externalAssetsPath: calmConfig.get<string>('externalAssetsPath'),
            extraFolders,
        });
        const result = loadPacksFromDirectories(dirs);
        for (const warning of result.warnings) {
            const loc = warning.file ? ` ${warning.file}` : '';
            this.log.appendLine(`[WARN] Pack load${loc}: ${warning.message}`);
        }
        this.packs = result.packs;
        this.log.appendLine(
            `[INFO] Loaded ${this.packs.length} extension packs: ${this.packs.map((p) => p.id).join(', ')}`
        );
        return this.packs;
    }

    registerWatchers(onChange: () => void): void {
        this.disposeWatchers();
        const glob = new vscode.RelativePattern(
            this.workspaceRoot() ?? this.context.extensionUri.fsPath,
            '**/*.extension.json'
        );
        this.watch(vscode.workspace.createFileSystemWatcher(glob), onChange);

        const extra = vscode.workspace
            .getConfiguration('calm')
            .get<string[]>('packs.folders', []);
        for (const folder of extra) {
            const abs = this.resolveFolder(
                folder,
                (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath)
            );
            this.watch(
                vscode.workspace.createFileSystemWatcher(
                    new vscode.RelativePattern(abs, '**/*.extension.json')
                ),
                onChange
            );
        }

        this.context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (
                    e.affectsConfiguration('calm.packs.folders') ||
                    e.affectsConfiguration('calm.externalAssetsPath')
                ) {
                    onChange();
                }
            })
        );
    }

    dispose(): void {
        this.disposeWatchers();
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
    }

    private watch(watcher: vscode.FileSystemWatcher, onChange: () => void): void {
        const bump = () => {
            if (this.debounceTimer) clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(onChange, 200);
        };
        watcher.onDidCreate(bump);
        watcher.onDidChange(bump);
        watcher.onDidDelete(bump);
        this.watchers.push(watcher);
        this.context.subscriptions.push(watcher);
    }

    private disposeWatchers(): void {
        for (const watcher of this.watchers) watcher.dispose();
        this.watchers = [];
    }

    private workspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    private resolveFolder(folder: string, workspaceFolders: string[]): string {
        if (path.isAbsolute(folder)) return folder;
        return path.resolve(workspaceFolders[0] ?? process.cwd(), folder);
    }
}
