import * as vscode from 'vscode'
import { CalmPreviewPanel } from './previewPanel'
import { CalmTreeProvider } from './treeView'
import { ModelIndex, detectCalmModel, loadCalmModel, toGraph } from './util/model'
import { provideHovers, provideCodeLens } from './util/language'

export function activate(context: vscode.ExtensionContext) {
    try {
        const output = vscode.window.createOutputChannel('CALM')
        output.appendLine('CALM extension: Starting full activation...')
        output.show()

        const treeProvider = new CalmTreeProvider(() => currentModelIndex)
        output.appendLine('CALM extension: Tree provider created')

        const treeView = vscode.window.createTreeView('calmSidebar', { treeDataProvider: treeProvider })
        output.appendLine('CALM extension: Tree view created')

        treeProvider.attach(treeView)
        context.subscriptions.push(treeView)
        output.appendLine('CALM extension: Tree view attached and subscribed')

        treeView.onDidChangeSelection(async (ev) => {
            const id = ev.selection?.[0]?.id
            if (!id) return
            if (currentPreview) currentPreview.postSelect(id)
            const uri = currentPreview?.getCurrentUri()
            const fallbackDoc = vscode.window.activeTextEditor?.document
            const selDoc = uri ? (vscode.workspace.textDocuments.find(d => d.uri.fsPath === uri.fsPath) || fallbackDoc) : fallbackDoc
            if (selDoc) revealById(selDoc, id)
        })

        let currentPreview: CalmPreviewPanel | undefined
        let currentModelIndex: ModelIndex | undefined
        let refreshTimeout: NodeJS.Timeout | undefined

        const config = () => vscode.workspace.getConfiguration('calm')

        const openPreview = vscode.commands.registerCommand('calm.openPreview', async () => {
            output.appendLine('CALM: openPreview command called')
            const editor = vscode.window.activeTextEditor
            if (!editor) {
                output.appendLine('CALM: No active editor')
                return
            }
            const doc = editor.document
            if (!(doc.languageId === 'json' || doc.languageId === 'yaml' || doc.languageId === 'yml')) {
                output.appendLine(`CALM: Wrong language type: ${doc.languageId}`)
                return
            }

            const text = doc.getText()
            const detected = detectCalmModel(text)
            output.appendLine(`CALM: CALM model detected: ${detected}`)
            if (!detected) {
                vscode.window.showWarningMessage('This file does not look like a CALM model.')
                return
            }

            if (!currentPreview) {
                currentPreview = CalmPreviewPanel.createOrShow(context, doc.uri, config(), output)
                currentPreview.onDidDispose(() => { currentPreview = undefined })
                currentPreview.onRevealInEditor((id) => {
                    const uri = currentPreview?.getCurrentUri()
                    const targetDoc = uri ? (vscode.workspace.textDocuments.find(d => d.uri.fsPath === uri.fsPath) || doc) : doc
                    revealById(targetDoc, id)
                })
                currentPreview.onDidSelect(async (id) => {
                    try { await treeProvider.revealById(id) } catch { }
                    // also highlight in editor
                    const uri = currentPreview?.getCurrentUri()
                    const targetDoc = uri ? (vscode.workspace.textDocuments.find(d => d.uri.fsPath === uri.fsPath) || doc) : doc
                    revealById(targetDoc, id)
                })
            } else {
                currentPreview.reveal(doc.uri)
            }

            await refreshForDocument(doc)
        })

        context.subscriptions.push(openPreview)
        output.appendLine('CALM extension: Command registered successfully')

        // Language features
        output.appendLine('CALM extension: Registering language features...')
        context.subscriptions.push(
            vscode.languages.registerHoverProvider([{ language: 'json' }, { language: 'yaml' }], provideHovers(() => currentModelIndex)),
            vscode.languages.registerCodeLensProvider([{ language: 'json' }, { language: 'yaml' }], provideCodeLens(() => currentModelIndex))
        )
        output.appendLine('CALM extension: Language features registered')

        // Watch CALM files
        output.appendLine('CALM extension: Setting up file watchers...')
        const globs = config().get<string[]>('files.globs', ["calm/**/*.json", "calm/**/*.y?(a)ml"]) || ["calm/**/*.json", "calm/**/*.y?(a)ml"]
        const folders = vscode.workspace.workspaceFolders ?? []
        if (folders.length > 0) {
            for (const folder of folders) {
                for (const g of globs) {
                    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, g))
                    watcher.onDidChange((uri: vscode.Uri) => maybeRefresh(uri))
                    watcher.onDidCreate((uri: vscode.Uri) => maybeRefresh(uri))
                    watcher.onDidDelete((uri: vscode.Uri) => maybeRefresh(uri))
                    context.subscriptions.push(watcher)
                }
            }
        }
        output.appendLine('CALM extension: File watchers set up')

        vscode.workspace.onDidSaveTextDocument((doc: vscode.TextDocument) => maybeRefresh(doc.uri))
        vscode.workspace.onDidOpenTextDocument((doc: vscode.TextDocument) => {
            if ((doc.languageId === 'json' || doc.languageId === 'yaml' || doc.languageId === 'yml') && config().get('preview.autoOpen', false)) {
                if (detectCalmModel(doc.getText())) {
                    vscode.commands.executeCommand('calm.openPreview')
                }
            }
        })
        vscode.window.onDidChangeTextEditorSelection((ev: vscode.TextEditorSelectionChangeEvent) => {
            if (!currentPreview || !currentModelIndex) return
            const id = currentModelIndex.idAt(ev.textEditor.document, ev.selections[0].active)
            if (id) currentPreview.postSelect(id)
        })

        async function maybeRefresh(uri: vscode.Uri) {
            const active = vscode.window.activeTextEditor?.document.uri
            if (!active || active.fsPath !== uri.fsPath) return
            if (refreshTimeout) clearTimeout(refreshTimeout)
            refreshTimeout = setTimeout(() => {
                const doc = vscode.window.activeTextEditor?.document
                if (doc) refreshForDocument(doc)
            }, 250)
        }

        async function refreshForDocument(doc: vscode.TextDocument) {
            try {
                const text = doc.getText()
                const model = loadCalmModel(text)
                currentModelIndex = new ModelIndex(doc, model)
                treeProvider.setModel(currentModelIndex)
                const graph = toGraph(model, config())
                currentPreview?.setData({ graph, selectedId: undefined, settings: getPreviewSettings() })
                if (!currentPreview && config().get('preview.autoOpen', false)) {
                    vscode.commands.executeCommand('calm.openPreview')
                }
            } catch (e: any) {
                output.appendLine(`Failed to refresh preview: ${e?.message || e}`)
            }
        }

        function getPreviewSettings() {
            const cfg = config()
            return {
                layout: cfg.get('preview.layout', 'dagre'),
                showLabels: cfg.get('preview.showLabels', true)
            }
        }

        async function revealById(doc: vscode.TextDocument, id: string) {
            if (!currentModelIndex) return
            const range = (currentModelIndex as any).rangeOf(id)
            if (!range) return
            // Prefer an already-open tab/editor for this document (visible or background)
            const byVisible = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === doc.uri.fsPath)
            // Search background tabs as well
            let targetColumn: vscode.ViewColumn | undefined = byVisible?.viewColumn
            if (!targetColumn) {
                try {
                    for (const group of vscode.window.tabGroups.all) {
                        // A group may not have a viewColumn in older VS Code, but 1.88+ does
                        const col = (group as any).viewColumn as vscode.ViewColumn | undefined
                        if (!col) continue
                        for (const tab of group.tabs) {
                            const input: any = (tab as any).input
                            const uri: vscode.Uri | undefined = input?.uri || input?.primary || input?.original
                            if (uri && uri.fsPath === doc.uri.fsPath) {
                                targetColumn = col
                                break
                            }
                        }
                        if (targetColumn) break
                    }
                } catch {
                    // best-effort; fall back below
                }
            }
            const editor = await vscode.window.showTextDocument(doc, targetColumn ? { viewColumn: targetColumn, preserveFocus: false } : { preserveFocus: false })
            editor.selection = new vscode.Selection(range.start, range.end)
            editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
        }

        output.appendLine('CALM extension: Full activation completed successfully')

    } catch (error) {
        console.error('CALM extension activation failed:', error)
        vscode.window.showErrorMessage(`CALM extension failed to activate: ${error}`)
        throw error
    }
}

export function deactivate() { }