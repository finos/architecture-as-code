import * as vscode from 'vscode'
import { CalmExtensionController } from './calm-extension-controller'
import type { CalmExtensionTestApi } from './test-api'


let controller: CalmExtensionController | undefined

export async function activate(context: vscode.ExtensionContext): Promise<CalmExtensionTestApi | undefined> {
    controller = new CalmExtensionController()
    await controller.start(context)
    return controller.getTestApi()
}

export function deactivate() {
    controller?.dispose()
}