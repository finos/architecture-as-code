import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import * as vscode from 'vscode'
import * as fs from 'fs'
import { DocifyScaffoldRunner } from './docify-scaffold-runner'
import { WebsiteFormData } from './types'
import { IDocifierFactory, IDocifier } from '../../cli/docifier-factory'
import { createMockWindow, createMockFs, createMockDocifier, createMockDocifierFactory } from './test-utils'

// Mock vscode module
vi.mock('vscode', () => ({
    commands: {
        registerCommand: vi.fn((command: string, callback: Function) => {
            return { command, callback, dispose: vi.fn() }
        }),
        executeCommand: vi.fn()
    },
    window: {
        activeTextEditor: undefined,
        showOpenDialog: vi.fn(),
        showInputBox: vi.fn(),
        showInformationMessage: vi.fn(),
        showErrorMessage: vi.fn(),
        createQuickPick: vi.fn(),
        withProgress: vi.fn(),
        createTerminal: vi.fn()
    },
    Uri: {
        file: (path: string) => ({ fsPath: path, scheme: 'file' })
    },
    ProgressLocation: {
        Notification: 15
    }
}))

describe('DocifyScaffoldRunner', () => {
    let mockWindow: typeof vscode.window
    let mockFs: typeof fs
    let mockDocifierFactory: IDocifierFactory
    let mockDocifier: IDocifier
    let runner: DocifyScaffoldRunner

    beforeEach(() => {
        mockWindow = createMockWindow()
        mockFs = createMockFs()
        mockDocifier = createMockDocifier()
        mockDocifierFactory = createMockDocifierFactory(mockDocifier)
        runner = new DocifyScaffoldRunner(mockWindow, mockFs, mockDocifierFactory, '/extension')
    })

    it('should run docify with correct parameters', async () => {
        const formData: WebsiteFormData = {
            architecturePath: '/test/arch.json',
            outputDir: '/test/output',
            mappingFilePath: '/test/mapping.json',
            templateBundlePath: '/test/template'
        }

        ;(mockWindow.withProgress as Mock).mockImplementation(async (options, task) => {
            const mockProgress = { report: vi.fn() }
            return await task(mockProgress)
        })

        await runner.run(formData)

        expect(mockDocifierFactory.create).toHaveBeenCalledWith({
            mode: 'USER_PROVIDED',
            inputPath: '/test/arch.json',
            outputPath: '/test/output',
            urlMappingPath: '/test/mapping.json',
            templateProcessingMode: 'bundle',
            templatePath: '/test/template',
            clearOutputDirectory: false,
            scaffoldOnly: true
        })
        expect(mockDocifier.docify).toHaveBeenCalled()
    })

    it('should use default template when not provided', async () => {
        const formData: WebsiteFormData = {
            architecturePath: '/test/arch.json',
            outputDir: '/test/output'
        }

        ;(mockWindow.withProgress as Mock).mockImplementation(async (options, task) => {
            const mockProgress = { report: vi.fn() }
            return await task(mockProgress)
        })

        await runner.run(formData)

        expect(mockDocifierFactory.create).toHaveBeenCalledWith({
            mode: 'USER_PROVIDED',
            inputPath: '/test/arch.json',
            outputPath: '/test/output',
            urlMappingPath: undefined,
            templateProcessingMode: 'bundle',
            templatePath: '/extension/dist/template-bundles/docusaurus',
            clearOutputDirectory: false,
            scaffoldOnly: true
        })
    })

    it('should throw error when output directory not created', async () => {
        const formData: WebsiteFormData = {
            architecturePath: '/test/arch.json',
            outputDir: '/test/output'
        }

        ;(mockFs.existsSync as Mock).mockReturnValue(false)
        ;(mockWindow.withProgress as Mock).mockImplementation(async (options, task) => {
            const mockProgress = { report: vi.fn() }
            return await task(mockProgress)
        })

        await expect(runner.run(formData)).rejects.toThrow('Output directory was not created')
    })

    it('should report progress during execution', async () => {
        const formData: WebsiteFormData = {
            architecturePath: '/test/arch.json',
            outputDir: '/test/output'
        }

        const mockProgress = { report: vi.fn() }
        ;(mockWindow.withProgress as Mock).mockImplementation(async (options, task) => {
            return await task(mockProgress)
        })

        await runner.run(formData)

        expect(mockProgress.report).toHaveBeenCalledWith({ increment: 0, message: 'Initializing...' })
        expect(mockProgress.report).toHaveBeenCalledWith({ increment: 30, message: 'Running docify scaffold...' })
        expect(mockProgress.report).toHaveBeenCalledWith({ increment: 70, message: 'Finalizing...' })
        expect(mockProgress.report).toHaveBeenCalledWith({ increment: 100, message: 'Done!' })
    })
})
