import * as vscode from 'vscode'
import { ConfigPort } from '../ports/config.port'

export class ConfigService implements ConfigPort {
    private get config() {
        return vscode.workspace.getConfiguration('calm')
    }

    filesGlobs(): string[] {
        return this.config.get<string[]>('files.globs', ["calm/**/*.json", "calm/**/*.y?(a)ml"])
    }

    templateGlobs(): string[] {
        return this.config.get<string[]>('template.globs', ["**/*.md", "**/*.markdown", "**/*.hbs", "**/*.handlebars"])
    }

    autoOpen(): boolean {
        return this.config.get<boolean>('preview.autoOpen', false)
    }

    previewLayout(): string {
        return this.config.get<string>('preview.layout', 'dagre')
    }

    showLabels(): boolean {
        return this.config.get<boolean>('preview.showLabels', true)
    }
}
