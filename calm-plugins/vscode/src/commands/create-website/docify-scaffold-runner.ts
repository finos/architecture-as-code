import * as vscode from 'vscode'
import * as fs from 'fs'
import { IDocifierFactory } from '../../cli/docifier-factory'
import { WebsiteFormData } from './types'
import { getTemplateBundlePath } from './form-item-factory'

export class DocifyScaffoldRunner {
    constructor(
        private readonly window: typeof vscode.window,
        private readonly fileSystem: typeof fs,
        private readonly docifierFactory: IDocifierFactory,
        private readonly extensionPath: string
    ) {}

    async run(formData: WebsiteFormData): Promise<void> {
        await this.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Creating website scaffold...',
                cancellable: false
            },
            async (progress) => {
                progress.report({ increment: 0, message: 'Initializing...' })

                const templateBundlePath = getTemplateBundlePath(formData, this.extensionPath)

                progress.report({ increment: 30, message: 'Running docify scaffold...' })

                const docifier = this.docifierFactory.create({
                    mode: 'USER_PROVIDED',
                    inputPath: formData.architecturePath,
                    outputPath: formData.outputDir,
                    urlMappingPath: formData.mappingFilePath,
                    templateProcessingMode: 'bundle',
                    templatePath: templateBundlePath,
                    clearOutputDirectory: false,
                    scaffoldOnly: true
                })

                await docifier.docify()

                progress.report({ increment: 70, message: 'Finalizing...' })

                if (!this.fileSystem.existsSync(formData.outputDir)) {
                    throw new Error('Output directory was not created')
                }

                progress.report({ increment: 100, message: 'Done!' })
            }
        )
    }
}
