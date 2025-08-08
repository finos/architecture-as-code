import * as vscode from 'vscode'
import { CalmPreviewPanel } from './previewPanel'
import { CalmTreeProvider } from './treeView'
import { ModelIndex, detectCalmModel, loadCalmModel, toGraph } from './util/model'
import { runCliValidate, runCliDocify } from './util/cli'
import { provideHovers, provideCodeLens } from './util/language'
import { DiagnosticsManager } from './util/diagnostics'

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel('CALM')
    const diagnostics = new DiagnosticsManager('calm')

    const treeProvider = new CalmTreeProvider(() => currentModelIndex)
    vscode.window.registerTreeDataProvider('calmSidebar', treeProvider)

    let currentPreview: CalmPreviewPanel | undefined
    let currentModelIndex: ModelIndex | undefined
    let refreshTimeout: NodeJS.Timeout | undefined

    const config = () => vscode.workspace.getConfiguration('calm')

    const openPreview = vscode.commands.registerCommand('calm.openPreview', async () => {
        const editor = vscode.window.activeTextEditor
        if (!editor) return
        const doc = editor.document
        if (!(doc.languageId === 'json' || doc.languageId === 'yaml' || doc.languageId === 'yml')) return

        const text = doc.getText()
        const detected = detectCalmModel(text)
        if (!detected) {
            vscode.window.showWarningMessage('This file does not look like a CALM model.')
            return
        }

        if (!currentPreview) {
            currentPreview = CalmPreviewPanel.createOrShow(context, doc.uri, config(), output)
            currentPreview.onDidDispose(() => { currentPreview = undefined })
            currentPreview.onRevealInEditor((id) => revealById(doc, id))
        } else {
            currentPreview.reveal(doc.uri)
        }

        await refreshForDocument(doc)
    })

    const validateModel = vscode.commands.registerCommand('calm.validateModel', async () => {
        const editor = vscode.window.activeTextEditor
        if (!editor) return
        const doc = editor.document
        const folder = vscode.workspace.getWorkspaceFolder(doc.uri)
        diagnostics.clear(doc.uri)
        try {
            const cliPath = config().get<string>('cli.path') || './cli'
            const result = await runCliValidate(cliPath, doc.uri, folder?.uri.fsPath, output)
            diagnostics.apply(doc.uri, result.diagnostics)
            if (result.ok) vscode.window.showInformationMessage('CALM validation passed')
            else vscode.window.showWarningMessage('CALM validation reported issues')
        } catch (e: any) {
            // Fallback basic validation
            const text = doc.getText()
            const model = loadCalmModel(text)
            const diags = DiagnosticsManager.basicValidate(model)
            diagnostics.apply(doc.uri, diags)
            vscode.window.showWarningMessage('CLI validation unavailable. Ran basic validation instead.')
        }
    })

    const generateDocs = vscode.commands.registerCommand('calm.generateDocs', async () => {
        const editor = vscode.window.activeTextEditor
        if (!editor) return
        const doc = editor.document
        const folder = vscode.workspace.getWorkspaceFolder(doc.uri)
        const cliPath = config().get<string>('cli.path') || './cli'
        try {
            const res = await runCliDocify(cliPath, doc.uri, folder?.uri.fsPath, output)
            if (res.ok) {
                const open = 'Open Folder'
                const pick = await vscode.window.showInformationMessage(`Docs generated at ${res.outputDir}`, open)
                if (pick === open && res.outputDir) {
                    vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(res.outputDir), { forceNewWindow: false })
                }
            } else {
                vscode.window.showWarningMessage('Doc generation reported issues')
            }
        } catch (e: any) {
            vscode.window.showErrorMessage(`Doc generation failed: ${e?.message || e}`)
        }
    })

    const revealInTree = vscode.commands.registerCommand('calm.revealInTree', async (id?: string) => {
        const editor = vscode.window.activeTextEditor
        if (!editor || !currentModelIndex) return
        const doc = editor.document
        const pickId = id || currentModelIndex.idAt(doc, editor.selection.active)
        if (pickId) {
            await revealById(doc, pickId)
            currentPreview?.postSelect(pickId)
        }
    })

    context.subscriptions.push(openPreview, validateModel, generateDocs, revealInTree)

    // Language features
    context.subscriptions.push(
        vscode.languages.registerHoverProvider([{ language: 'json' }, { language: 'yaml' }], provideHovers(() => currentModelIndex)),
        vscode.languages.registerCodeLensProvider([{ language: 'json' }, { language: 'yaml' }], provideCodeLens(() => currentModelIndex))
    )

    // Watch CALM files
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
        const editor = await vscode.window.showTextDocument(doc)
        editor.selection = new vscode.Selection(range.start, range.end)
        editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
    }
}

export function deactivate() { }
