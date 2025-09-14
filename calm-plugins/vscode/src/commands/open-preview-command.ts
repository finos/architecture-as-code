import * as vscode from 'vscode'
import { detectFileType, FileType } from '../domain/file-types'
import type { CommandDeps } from './types'

export function registerOpenPreview({ ctx, output, config, refresh, selection, tree, preview, setTemplateMode }: CommandDeps) {
    const getCurrentSelection = () => tree.getCurrentSelectionId()

    const disposable = vscode.commands.registerCommand('calm.openPreview', async () => {
        const editor = vscode.window.activeTextEditor
        if (!editor) return
        const doc = editor.document
        const fileInfo = detectFileType(doc.uri.fsPath)

        if (fileInfo.type === FileType.ArchitectureFile && fileInfo.isValid) {
            output.appendLine(`[command] Opening preview for architecture file: ${doc.uri.fsPath}`)
        } else if (fileInfo.type === FileType.TemplateFile && fileInfo.isValid) {
            output.appendLine(`[command] Opening preview for template file: ${doc.uri.fsPath} -> ${fileInfo.architecturePath}`)
        } else {
            vscode.window.showWarningMessage('This file is not a CALM architecture file or a template file with architecture reference.')
            return
        }

        let panel = preview.get()
        if (!panel) {
            panel = preview.createOrShow(ctx, doc.uri, config, output)
            preview.clearOnDispose()

            panel.setGetCurrentTreeSelection(getCurrentSelection)
            panel.onRevealInEditor(async id => { await selection.syncFromPreview(id) })
            panel.onDidSelect(async id => { await selection.syncFromPreview(id) })
        } else {
            panel.reveal(doc.uri)
        }

        const result = await refresh.refreshForDocument(doc)
        if (result) setTemplateMode(result.isTemplateMode)
    })

    ctx.subscriptions.push(disposable)
}
