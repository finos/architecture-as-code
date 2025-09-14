import * as vscode from 'vscode'
import type { CommandDeps } from './types'

export function registerSearchTreeView({ ctx, tree }: CommandDeps) {
    const disposable = vscode.commands.registerCommand('calm.searchTreeView', async () => {
        const searchText = await vscode.window.showInputBox({
            prompt: 'Search CALM Architecture Elements',
            placeHolder: 'Enter text to filter nodes, relationships, and flows...',
            value: tree.getSearchFilter()
        })
        if (searchText !== undefined) {
            tree.setSearchFilter(searchText)
            if (searchText.trim()) {
                setTimeout(() => { tree.expandRoot() }, 100)
            }
        }
    })
    ctx.subscriptions.push(disposable)
}
