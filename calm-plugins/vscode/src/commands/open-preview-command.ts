import * as vscode from 'vscode'
import { detectFileType, FileType } from '../models/file-types'
import type { ApplicationStoreApi } from '../application-store'

export function createOpenPreviewCommand(store: ApplicationStoreApi) {
    return vscode.commands.registerCommand('calm.openPreview', async (elementId?: string) => {
        const editor = vscode.window.activeTextEditor
        if (!editor) return
        const doc = editor.document
        const fileInfo = detectFileType(doc.uri.fsPath)

        if (fileInfo.type === FileType.ArchitectureFile && fileInfo.isValid) {
            // Valid architecture file
        } else if (fileInfo.type === FileType.TemplateFile && fileInfo.isValid) {
            // Valid template file with architecture reference
        } else {
            vscode.window.showWarningMessage('This file is not a CALM architecture file or a template file with architecture reference.')
            return
        }

        const state = store.getState()
        
        // Set document first, then force flag - order matters because each setter triggers the subscription
        // The forceCreatePreview check uses currentDocumentUri, so it must be set first
        state.setCurrentDocument(doc.uri)
        
        if (fileInfo.type === FileType.TemplateFile && fileInfo.isValid) {
            state.setTemplateMode(true, doc.uri.fsPath, fileInfo.architecturePath)
        } else {
            state.setTemplateMode(false)
        }

        // If an elementId was provided (from CodeLens), set the selection
        if (elementId) {
            state.setSelectedElement(elementId)
        }

        // Set force flag last - this triggers the StoreReactionMediator to create the panel
        // with the correct document URI already in place
        state.setForceCreatePreview(true)
    })
}
