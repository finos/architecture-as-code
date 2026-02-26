import type { ApplicationStoreApi } from '../application-store'
import type { NavigationService } from '../core/services/navigation-service'
import { createOpenPreviewCommand } from './open-preview-command'
import { createSearchTreeViewCommand } from './search-tree-view-command'
import { createClearTreeViewSearchCommand } from './clear-tree-view-search-command'
import { createCreateWebsiteCommand } from './create-website/create-website-command'
import { createNavigateToArchitectureCommand } from './navigate-to-architecture-command'
import * as vscode from 'vscode'

export class CommandRegistrar {
    constructor(
        private context: vscode.ExtensionContext,
        private store: ApplicationStoreApi,
        private navigation: NavigationService
    ) {}

    registerAll() {
        const commands = [
            createOpenPreviewCommand(this.store),
            createSearchTreeViewCommand(this.store),
            createClearTreeViewSearchCommand(this.store),
            createCreateWebsiteCommand(this.context),
            createNavigateToArchitectureCommand(this.navigation)
        ]

        commands.forEach(disposable => {
            this.context.subscriptions.push(disposable)
        })
    }
}
