import * as vscode from 'vscode'
import { CalmExtensionController } from './calm-extension-controller'


let controller: CalmExtensionController | undefined

export function activate(context: vscode.ExtensionContext) {
    controller = new CalmExtensionController()
    controller.start(context)
}

export function deactivate() {
    controller?.dispose()
}