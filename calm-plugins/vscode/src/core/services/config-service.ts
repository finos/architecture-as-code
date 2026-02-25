import * as vscode from 'vscode'
import { Config } from '../ports/config'

const themeMapping: { [key: string]: string } = {
    'Abyss': 'dark',
    'Default High Contrast': 'high-contrast-dark',
    'Default High Contrast Light': 'high-contrast-light',
    'Monokai': 'dark',
    'Monokai Dimmed': 'dark',
    'Red': 'dark',
    'Tomorrow Night Blue': 'dark'
}

export class ConfigService implements Config {
    private get config() {
        return vscode.workspace.getConfiguration('calm')
    }

    filesGlobs(): string[] {
        return this.config.get<string[]>('files.globs', ["calm/**/*.json", "calm/**/*.y?(a)ml"])
    }

    templateGlobs(): string[] {
        return this.config.get<string[]>('template.globs', ["**/*.md", "**/*.markdown", "**/*.hbs", "**/*.handlebars"])
    }

    previewLayout(): string {
        return this.config.get<string>('preview.layout', 'elk')
    }

    showLabels(): boolean {
        return this.config.get<boolean>('preview.showLabels', true)
    }

    urlMapping(): string | undefined {
        return this.config.get<string>('urlMapping')
    }

    docifyTheme(): string {
        const themeSetting = this.config.get<string>('docify.theme', 'auto')
        if (themeSetting === 'auto') {
            const vscodeTheme: string = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme') || 'Default Light';

            // Default to a heuristic that themes are 'Dark' if they say 'Dark'.
            let chosenTheme = vscodeTheme.includes('Dark') ? 'dark' : 'light';

            // Override with specific mappings
            if (themeMapping[vscodeTheme]) {
                chosenTheme = themeMapping[vscodeTheme];
            }

            return chosenTheme;
        }
        return themeSetting
    }

    schemaAdditionalFolders(): string[] {
        return this.config.get<string[]>('schemas.additionalFolders', [])
    }
}
