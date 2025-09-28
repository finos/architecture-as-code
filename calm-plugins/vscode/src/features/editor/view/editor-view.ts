import * as vscode from 'vscode'
import type { EditorViewModel } from '../view-model/editor-view-model'
import { detectFileType, FileType } from '../../../models/file-types'

export interface EditorViewEvents {
    onActiveEditorChanged: (doc: vscode.TextDocument) => void
}

/**
 * EditorView - handles VSCode text editor interactions and language features
 * Pure View layer that uses ViewModel for data and emits events for actions
 */
export class EditorView implements vscode.Disposable {
    private disposables: vscode.Disposable[] = []

    constructor(
        private viewModel: EditorViewModel,
        private events: EditorViewEvents
    ) {
        this.registerEventHandlers()
        this.registerLanguageFeatures()
    }

    private registerEventHandlers(): void {
        // Handle active editor changes
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (!editor) return
                
                const doc = editor.document
                const ft = detectFileType(doc.uri.fsPath)
                
                if (
                    (ft.type === FileType.ArchitectureFile && ft.isValid) ||
                    (ft.type === FileType.TemplateFile && ft.isValid)
                ) {
                    this.events.onActiveEditorChanged(doc)
                }
            })
        )
    }

    private registerLanguageFeatures(): void {
        this.disposables.push(
            vscode.languages.registerHoverProvider(
                [{ language: 'json' }, { language: 'yaml' }],
                this.createHoverProvider()
            ),
            vscode.languages.registerCodeLensProvider(
                [{ language: 'json' }, { language: 'yaml' }],
                this.createCodeLensProvider()
            )
        )
    }

    private createHoverProvider(): vscode.HoverProvider {
        return {
            provideHover: (doc: vscode.TextDocument, pos: vscode.Position) => {
                const modelIndex = this.viewModel.getCurrentModelIndex()
                if (!modelIndex) return undefined
                
                // Get word under cursor
                const word = doc.getText(doc.getWordRangeAtPosition(pos, /[A-Za-z0-9_-]+/))
                if (!word) return undefined
                
                // Check if this word has a range in the model
                const range = this.viewModel.getRangeForId(word)
                if (!range) return undefined
                
                return new vscode.Hover(`CALM id: ${word}`)
            }
        }
    }

    private createCodeLensProvider(): vscode.CodeLensProvider {
        return {
            provideCodeLenses: (doc: vscode.TextDocument) => {
                const text = doc.getText()
                const lenses: vscode.CodeLens[] = []
                const rx = /"(?:id|unique-id)"\s*:\s*"([^"]+)"/g
                let m: RegExpExecArray | null
                
                while ((m = rx.exec(text))) {
                    const id = m[1]
                    const range = new vscode.Range(
                        doc.positionAt(m.index), 
                        doc.positionAt(m.index + m[0].length)
                    )
                    lenses.push(new vscode.CodeLens(range, { 
                        command: 'calm.openPreview', 
                        title: 'Reveal in Graph',
                        arguments: [id]
                    }))
                }
                
                return lenses
            }
        }
    }

    /**
     * Reveal a specific ID in the text editor
     */
    async revealById(doc: vscode.TextDocument, id: string): Promise<void> {
        const range = this.viewModel.getRangeForId(id)
        if (!range) return

        // Find the appropriate view column
        const byVisible = vscode.window.visibleTextEditors.find(e => 
            e.document.uri.fsPath === doc.uri.fsPath
        )
        let targetColumn: vscode.ViewColumn | undefined = byVisible?.viewColumn

        if (!targetColumn) {
            try {
                for (const group of vscode.window.tabGroups.all) {
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
            } catch { }
        }

        // Show the document and reveal the range
        const editor = await vscode.window.showTextDocument(
            doc,
            targetColumn ? { viewColumn: targetColumn, preserveFocus: false } : { preserveFocus: false }
        )
        
        editor.selection = new vscode.Selection(range.start, range.end)
        editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose())
    }
}