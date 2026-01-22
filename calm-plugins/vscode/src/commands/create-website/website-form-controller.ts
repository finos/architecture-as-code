import * as vscode from 'vscode'
import { WebsiteFormData, FormQuickPickItem } from './types'
import { getDefaultOutputDir, createFormItems, validateOutputDirectory } from './form-item-factory'

export class WebsiteFormController {
    constructor(private readonly window: typeof vscode.window) {}

    async show(architecturePath: string): Promise<WebsiteFormData | undefined> {
        const formState: WebsiteFormData = {
            architecturePath,
            outputDir: getDefaultOutputDir(architecturePath),
            mappingFilePath: undefined,
            templateBundlePath: undefined
        }

        return new Promise((resolve) => {
            const quickPick = this.window.createQuickPick<FormQuickPickItem>()
            quickPick.title = 'Create CALM Website'
            quickPick.placeholder = 'Configure options and select "Create Website" to proceed'
            quickPick.canSelectMany = false

            let resolved = false
            const updateItems = () => { quickPick.items = createFormItems(formState) }

            updateItems()
            quickPick.show()

            quickPick.onDidAccept(async () => {
                const selected = quickPick.selectedItems[0]
                if (!selected) return

                if (selected.id === 'create') {
                    resolved = true
                    quickPick.hide()
                    quickPick.dispose()
                    resolve(formState)
                    return
                }

                await this.handleFieldSelection(selected.id, formState, quickPick, updateItems)
            })

            quickPick.onDidHide(() => {
                if (!resolved) {
                    resolve(undefined)
                    quickPick.dispose()
                }
            })
        })
    }

    private async handleFieldSelection(
        id: 'outputDir' | 'mappingFile' | 'templateBundle',
        formState: WebsiteFormData,
        quickPick: vscode.QuickPick<FormQuickPickItem>,
        updateItems: () => void
    ): Promise<void> {
        quickPick.hide()

        switch (id) {
            case 'outputDir': {
                const newDir = await this.window.showInputBox({
                    prompt: 'Enter output directory for the website scaffold',
                    value: formState.outputDir,
                    validateInput: validateOutputDirectory
                })
                if (newDir) formState.outputDir = newDir
                break
            }
            case 'mappingFile': {
                const files = await this.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: { 'Mapping Files': ['json'] },
                    title: 'Select URL Mapping File (Cancel to clear)'
                })
                formState.mappingFilePath = files?.[0]?.fsPath
                break
            }
            case 'templateBundle': {
                const folders = await this.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    title: 'Select Custom Template Bundle Directory (Cancel to use default)'
                })
                formState.templateBundlePath = folders?.[0]?.fsPath
                break
            }
        }

        updateItems()
        quickPick.show()
    }
}
