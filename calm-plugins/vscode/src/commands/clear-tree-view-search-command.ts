import * as vscode from 'vscode'
import type { CommandDeps } from './types'

export function registerClearTreeViewSearch({ ctx, tree }: CommandDeps) {
    const disposable = vscode.commands.registerCommand('calm.clearTreeViewSearch', () => {
        tree.setSearchFilter('')
    })
    ctx.subscriptions.push(disposable)
}
