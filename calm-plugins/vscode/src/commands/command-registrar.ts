import type { CommandDeps } from './types'
import { registerOpenPreview } from './open-preview-command'
import { registerSearchTreeView } from './search-tree-view-command'
import { registerClearTreeViewSearch } from './clear-tree-view-search-command'

export class CommandRegistrar {
    constructor(private deps: CommandDeps) {}

    registerAll() {
        registerOpenPreview(this.deps)
        registerSearchTreeView(this.deps)
        registerClearTreeViewSearch(this.deps)
    }
}

