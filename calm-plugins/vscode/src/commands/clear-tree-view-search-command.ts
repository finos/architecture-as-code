import * as vscode from 'vscode'
import type { ApplicationStoreApi } from '../application-store'

export function createClearTreeViewSearchCommand(store: ApplicationStoreApi) {
    return vscode.commands.registerCommand('calm.clearTreeViewSearch', () => {
        store.getState().setSearchFilter('')
    })
}
