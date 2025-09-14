import * as vscode from 'vscode'
import { detectFileType, FileType } from '../domain/file-types'
import type { ModelIndex } from '../domain/model'
import type { RefreshService } from '../core/services/refresh-service'
import type { PreviewManager } from './preview-manager'
import type { SelectionService } from '../core/services/selection-service'

export class EditorGateway {
    constructor(private getModelIndex: () => ModelIndex | undefined) {}

    async revealById(doc: vscode.TextDocument, id: string) {
        const modelIndex = this.getModelIndex()
        if (!modelIndex) return
        const range = (modelIndex as any).rangeOf(id)
        if (!range) return

        const byVisible = vscode.window.visibleTextEditors.find(e => e.document.uri.fsPath === doc.uri.fsPath)
        let targetColumn: vscode.ViewColumn | undefined = byVisible?.viewColumn
        if (!targetColumn) {
            try {
                for (const group of vscode.window.tabGroups.all) {
                    const col = (group as any).viewColumn as vscode.ViewColumn | undefined
                    if (!col) continue
                    for (const tab of group.tabs) {
                        const input: any = (tab as any).input
                        const uri: vscode.Uri | undefined = input?.uri || input?.primary || input?.original
                        if (uri && uri.fsPath === doc.uri.fsPath) { targetColumn = col; break }
                    }
                    if (targetColumn) break
                }
            } catch {}
        }
        const editor = await vscode.window.showTextDocument(
            doc,
            targetColumn ? { viewColumn: targetColumn, preserveFocus: false } : { preserveFocus: false }
        )
        editor.selection = new vscode.Selection(range.start, range.end)
        editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
    }

    /** Bridge caret selections → preview highlights. */
    bindSelectionService(selection: SelectionService) {
        vscode.window.onDidChangeTextEditorSelection(ev => {
            selection.syncFromEditor(ev.textEditor)
        })
    }

    /** Bridge active editor changes → preview + refresh. */
    bindActiveEditorWatcher(
        preview: PreviewManager,
        refresh: RefreshService,
        setTemplateMode: (enabled: boolean) => void,
        output: vscode.OutputChannel
    ) {
        vscode.window.onDidChangeActiveTextEditor(editor => {
            const panel = preview.get()
            if (!editor || !panel) return
            const doc = editor.document
            const ft = detectFileType(doc.uri.fsPath)
            if (
                (ft.type === FileType.ArchitectureFile && ft.isValid) ||
                (ft.type === FileType.TemplateFile && ft.isValid)
            ) {
                output.appendLine('[extension] Detected file switch, updating preview: ' + doc.uri.fsPath)
                panel.reveal(doc.uri)
                const resultP = refresh.refreshForDocument(doc)
                resultP?.then(r => { if (r) setTemplateMode(r.isTemplateMode) })
            }
        })
    }
}
