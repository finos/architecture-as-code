import * as vscode from 'vscode'
import { detectFileType, FileType } from '../../models/file-types'
import { Config } from '../ports/config'
import { RefreshService } from './refresh-service'

export class WatchService {
    private disposables: vscode.Disposable[] = []

    constructor(
        private config: Config, // Use port instead of concrete service
        private refresh: RefreshService
    ) {}

    registerAll(context: vscode.ExtensionContext) {
        this.registerFileSystemWatchers(context)
        this.registerDocumentLifecycle()
        this.registerActiveEditorChange()
    }

    dispose() {
        this.disposables.forEach(d => { try { d.dispose() } catch {} })
        this.disposables = []
    }

    private registerFileSystemWatchers(context: vscode.ExtensionContext) {
        const globs = this.config.filesGlobs()
        const templateGlobs = this.config.templateGlobs()
        const allGlobs = [...globs, ...templateGlobs]
        const folders = vscode.workspace.workspaceFolders ?? []
        if (!folders.length) return

        for (const folder of folders) {
            for (const g of allGlobs) {
                const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, g))
                watcher.onDidChange(uri => this.refresh.maybeRefresh(uri))
                watcher.onDidCreate(uri => this.refresh.maybeRefresh(uri))
                watcher.onDidDelete(uri => this.refresh.maybeRefresh(uri))
                context.subscriptions.push(watcher)
            }
        }
    }

    private registerDocumentLifecycle() {
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(doc => this.refresh.maybeRefresh(doc.uri))
        )
    }

    private registerActiveEditorChange() {
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                // The controller still handles reveal + isTemplateMode, so we only trigger refresh here if needed.
                if (!editor) return
                const doc = editor.document
                const ft = detectFileType(doc.uri.fsPath)
                if (
                    (ft.type === FileType.ArchitectureFile && ft.isValid) ||
                    (ft.type === FileType.TemplateFile && ft.isValid)
                ) {
                    // Let the controller handle preview.reveal; we only refresh if the doc is valid
                    void this.refresh.refreshForDocument(doc)
                }
            })
        )
    }
}
