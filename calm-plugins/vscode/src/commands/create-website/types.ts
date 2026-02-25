import * as vscode from 'vscode'
import * as fs from 'fs'
import { IDocifierFactory } from '../../cli/docifier-factory'

export interface WebsiteFormData {
    architecturePath: string
    outputDir: string
    mappingFilePath?: string
    templateBundlePath?: string
}

export interface FormQuickPickItem extends vscode.QuickPickItem {
    id: 'outputDir' | 'mappingFile' | 'templateBundle' | 'create'
}

export interface Dependencies {
    window: typeof vscode.window
    commands: typeof vscode.commands
    fs: typeof fs
    docifierFactory: IDocifierFactory
    extensionPath: string
}
