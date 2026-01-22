import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import * as vscode from 'vscode'
import { WebsiteFormController } from './website-form-controller'
import { validateOutputDirectory } from './form-item-factory'
import { FormQuickPickItem } from './types'
import { createMockWindow } from './test-utils'

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

describe('WebsiteFormController', () => {
    let mockWindow: typeof vscode.window
    let controller: WebsiteFormController
    let mockQuickPick: any
    let acceptHandler: Function
    let hideHandler: Function

    beforeEach(() => {
        mockWindow = createMockWindow()

        // Create a more sophisticated mock QuickPick that captures handlers
        mockQuickPick = {
            title: '',
            placeholder: '',
            canSelectMany: false,
            items: [] as FormQuickPickItem[],
            selectedItems: [] as FormQuickPickItem[],
            show: vi.fn(),
            hide: vi.fn(),
            dispose: vi.fn(),
            onDidAccept: vi.fn((handler: Function) => {
                acceptHandler = handler
                return { dispose: vi.fn() }
            }),
            onDidHide: vi.fn((handler: Function) => {
                hideHandler = handler
                return { dispose: vi.fn() }
            })
        }

        ;(mockWindow.createQuickPick as Mock).mockReturnValue(mockQuickPick)
        controller = new WebsiteFormController(mockWindow)
    })

    it('should initialize form with default values', async () => {
        const showPromise = controller.show('/test/arch.json')

        // Trigger hide to cancel
        hideHandler()

        await showPromise

        expect(mockQuickPick.title).toBe('Create CALM Website')
        expect(mockQuickPick.placeholder).toBe('Configure options and select "Create Website" to proceed')
        expect(mockQuickPick.items).toHaveLength(4)
        expect(mockQuickPick.show).toHaveBeenCalled()
    })

    it('should return undefined when form is cancelled (hidden)', async () => {
        const showPromise = controller.show('/test/arch.json')

        // Simulate user pressing escape (hide without selecting create)
        hideHandler()

        const result = await showPromise

        expect(result).toBeUndefined()
        expect(mockQuickPick.dispose).toHaveBeenCalled()
    })

    it('should return form data when create is selected', async () => {
        const showPromise = controller.show('/test/arch.json')

        // Simulate selecting "create"
        mockQuickPick.selectedItems = [{ id: 'create' }]
        await acceptHandler()

        const result = await showPromise

        expect(result).toEqual({
            architecturePath: '/test/arch.json',
            outputDir: '/test/website',
            mappingFilePath: undefined,
            templateBundlePath: undefined
        })
    })

    it('should not proceed when no item is selected', async () => {
        const showPromise = controller.show('/test/arch.json')

        // Simulate accept with no selection
        mockQuickPick.selectedItems = []
        await acceptHandler()

        // Form should still be showing, trigger hide to complete
        hideHandler()

        const result = await showPromise

        expect(result).toBeUndefined()
    })

    it('should handle outputDir selection', async () => {
        ;(mockWindow.showInputBox as Mock).mockResolvedValue('/new/output/dir')

        const showPromise = controller.show('/test/arch.json')

        // Select outputDir
        mockQuickPick.selectedItems = [{ id: 'outputDir' }]
        await acceptHandler()

        expect(mockQuickPick.hide).toHaveBeenCalled()
        expect(mockWindow.showInputBox).toHaveBeenCalledWith({
            prompt: 'Enter output directory for the website scaffold',
            value: '/test/website',
            validateInput: validateOutputDirectory
        })
        expect(mockQuickPick.show).toHaveBeenCalledTimes(2) // Initial + after input

        // Now select create to complete
        mockQuickPick.selectedItems = [{ id: 'create' }]
        await acceptHandler()

        const result = await showPromise

        expect(result?.outputDir).toBe('/new/output/dir')
    })

    it('should not update outputDir when input is cancelled', async () => {
        ;(mockWindow.showInputBox as Mock).mockResolvedValue(undefined)

        const showPromise = controller.show('/test/arch.json')

        // Select outputDir but cancel input
        mockQuickPick.selectedItems = [{ id: 'outputDir' }]
        await acceptHandler()

        // Now select create to complete
        mockQuickPick.selectedItems = [{ id: 'create' }]
        await acceptHandler()

        const result = await showPromise

        expect(result?.outputDir).toBe('/test/website') // Should remain default
    })

    it('should handle mappingFile selection', async () => {
        ;(mockWindow.showOpenDialog as Mock).mockResolvedValue([{ fsPath: '/path/to/mapping.json' }])

        const showPromise = controller.show('/test/arch.json')

        // Select mappingFile
        mockQuickPick.selectedItems = [{ id: 'mappingFile' }]
        await acceptHandler()

        expect(mockWindow.showOpenDialog).toHaveBeenCalledWith({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'Mapping Files': ['json'] },
            title: 'Select URL Mapping File (Cancel to clear)'
        })

        // Now select create to complete
        mockQuickPick.selectedItems = [{ id: 'create' }]
        await acceptHandler()

        const result = await showPromise

        expect(result?.mappingFilePath).toBe('/path/to/mapping.json')
    })

    it('should clear mappingFile when dialog is cancelled', async () => {
        ;(mockWindow.showOpenDialog as Mock).mockResolvedValue(undefined)

        const showPromise = controller.show('/test/arch.json')

        // Select mappingFile but cancel dialog
        mockQuickPick.selectedItems = [{ id: 'mappingFile' }]
        await acceptHandler()

        // Select create to complete
        mockQuickPick.selectedItems = [{ id: 'create' }]
        await acceptHandler()

        const result = await showPromise

        expect(result?.mappingFilePath).toBeUndefined()
    })

    it('should handle templateBundle selection', async () => {
        ;(mockWindow.showOpenDialog as Mock).mockResolvedValue([{ fsPath: '/path/to/bundle' }])

        const showPromise = controller.show('/test/arch.json')

        // Select templateBundle
        mockQuickPick.selectedItems = [{ id: 'templateBundle' }]
        await acceptHandler()

        expect(mockWindow.showOpenDialog).toHaveBeenCalledWith({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: 'Select Custom Template Bundle Directory (Cancel to use default)'
        })

        // Now select create to complete
        mockQuickPick.selectedItems = [{ id: 'create' }]
        await acceptHandler()

        const result = await showPromise

        expect(result?.templateBundlePath).toBe('/path/to/bundle')
    })

    it('should clear templateBundle when dialog is cancelled', async () => {
        ;(mockWindow.showOpenDialog as Mock).mockResolvedValue(undefined)

        const showPromise = controller.show('/test/arch.json')

        // Select templateBundle but cancel dialog
        mockQuickPick.selectedItems = [{ id: 'templateBundle' }]
        await acceptHandler()

        // Select create to complete
        mockQuickPick.selectedItems = [{ id: 'create' }]
        await acceptHandler()

        const result = await showPromise

        expect(result?.templateBundlePath).toBeUndefined()
    })
})

