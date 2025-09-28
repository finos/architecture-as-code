import * as fs from 'fs/promises'
import * as path from 'path'
import type * as vscode from 'vscode'
import { SchemaDirectory } from '@finos/calm-shared'
import type { Logger } from '../ports/logger'

export class DiagnosticsService {
    constructor(private log: Logger) {}

    async logStartup(context: vscode.ExtensionContext) {
        await this.logVersion(context)
        this.log.info('Logger from @finos/calm-shared is working!')
        await this.checkSchemaDirectory()
    }

    private async logVersion(context: vscode.ExtensionContext) {
        try {
            const pkgPath = path.join(context.extensionUri.fsPath, 'package.json')
            const buf = await fs.readFile(pkgPath, 'utf8')
            const pj = JSON.parse(buf)
            const extVersion = pj?.version ?? 'dev'
            this.log.info('CALM extension version: v' + extVersion)
        } catch {
            this.log.info('CALM extension version: (unknown)')
        }
    }

    private async checkSchemaDirectory() {
        try {
            const dummyLoader = {
                initialise: async () => {},
                loadMissingDocument: async (_documentId: string, _type: any) => ({})
            }
            const dummy = new SchemaDirectory(dummyLoader, false)
            this.log.info('SchemaDirectory loaded from @finos/calm-shared: ' + typeof dummy)
        } catch (e: any) {
            this.log.error?.('Failed to load SchemaDirectory from @finos/calm-shared: ' + (e?.message || e))
        }
    }
}
