import * as vscode from 'vscode'
import { hasArchitectureExtension } from '@finos/calm-shared'

export class ArchitecturePathResolver {
    constructor(private readonly window: typeof vscode.window) {}

    async resolve(uri?: vscode.Uri): Promise<string | undefined> {
        if (uri) {
            return uri.fsPath
        }

        const activeEditor = this.window.activeTextEditor
        if (activeEditor && hasArchitectureExtension(activeEditor.document.uri.fsPath)) {
            return activeEditor.document.uri.fsPath
        }

        const files = await this.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'Architecture Files': ['json'] },
            title: 'Select CALM Architecture File'
        })

        return files?.[0]?.fsPath
    }
}
