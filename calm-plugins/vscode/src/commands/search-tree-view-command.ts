import * as vscode from 'vscode'
import type { ApplicationStoreApi } from '../application-store'

export function createSearchTreeViewCommand(store: ApplicationStoreApi) {
    return vscode.commands.registerCommand('calm.searchTreeView', async () => {
        const searchText = await vscode.window.showInputBox({
            prompt: 'Search CALM Architecture Elements',
            placeHolder: 'Enter text to filter nodes, relationships, and flows...',
            value: store.getState().searchFilter
        })
        if (searchText !== undefined) {
            store.getState().setSearchFilter(searchText)
        }
    })
}
