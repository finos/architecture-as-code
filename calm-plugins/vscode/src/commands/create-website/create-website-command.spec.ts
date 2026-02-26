import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import * as vscode from 'vscode'
import {
    CreateWebsiteCommandHandler,
    createCreateWebsiteCommand
} from './create-website-command'
import { FormQuickPickItem, Dependencies } from './types'
import {
    createMockDependencies,
    createMockDocifier
} from './test-utils'

// Mock @finos/calm-shared
vi.mock('@finos/calm-shared', () => ({
    hasArchitectureExtension: vi.fn((filePath: string) => /\.json$/i.test(filePath))
}))

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

describe('CreateWebsiteCommandHandler', () => {
    let deps: Dependencies
    let handler: CreateWebsiteCommandHandler
    let mockQuickPick: any
    let acceptHandler: Function
    let hideHandler: Function

    beforeEach(() => {
        deps = createMockDependencies()

        // Create a sophisticated mock QuickPick
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

        ;(deps.window.createQuickPick as Mock).mockReturnValue(mockQuickPick)
        handler = new CreateWebsiteCommandHandler(deps)
    })

    it('should exit early when no architecture path resolved', async () => {
        ;(deps.window.showOpenDialog as Mock).mockResolvedValue(undefined)

        await handler.execute()

        expect(deps.window.createQuickPick).not.toHaveBeenCalled()
    })

    it('should use URI path when provided', async () => {
        const uri = { fsPath: '/test/arch.json', scheme: 'file' } as vscode.Uri

        // Simulate immediate hide (cancel)
        setTimeout(() => {
            hideHandler()
        }, 0)

        await handler.execute(uri)

        expect(deps.window.showOpenDialog).not.toHaveBeenCalled()
        expect(deps.window.createQuickPick).toHaveBeenCalled()
    })

    it('should exit early when form is cancelled', async () => {
        const uri = { fsPath: '/test/arch.json', scheme: 'file' } as vscode.Uri

        // Simulate cancel
        setTimeout(() => {
            hideHandler()
        }, 0)

        await handler.execute(uri)

        expect(deps.window.withProgress).not.toHaveBeenCalled()
    })

    it('should run full flow when form is completed', async () => {
        const uri = { fsPath: '/test/arch.json', scheme: 'file' } as vscode.Uri
        const mockDocifier = createMockDocifier()
        ;(deps.docifierFactory.create as Mock).mockReturnValue(mockDocifier)
        ;(deps.window.withProgress as Mock).mockImplementation(async (options, task) => {
            return await task({ report: vi.fn() })
        })
        ;(deps.window.showInformationMessage as Mock).mockResolvedValue(undefined)

        // Simulate selecting create
        setTimeout(async () => {
            mockQuickPick.selectedItems = [{ id: 'create' }]
            await acceptHandler()
        }, 0)

        await handler.execute(uri)

        expect(deps.docifierFactory.create).toHaveBeenCalled()
        expect(mockDocifier.docify).toHaveBeenCalled()
        expect(deps.window.showInformationMessage).toHaveBeenCalledWith(
            'Website scaffold created at: /test/website',
            'Open Folder',
            'Open in Terminal'
        )
    })

    it('should handle Open Folder action after creation', async () => {
        const uri = { fsPath: '/test/arch.json', scheme: 'file' } as vscode.Uri
        const mockDocifier = createMockDocifier()
        ;(deps.docifierFactory.create as Mock).mockReturnValue(mockDocifier)
        ;(deps.window.withProgress as Mock).mockImplementation(async (options, task) => {
            return await task({ report: vi.fn() })
        })
        ;(deps.window.showInformationMessage as Mock).mockResolvedValue('Open Folder')

        setTimeout(async () => {
            mockQuickPick.selectedItems = [{ id: 'create' }]
            await acceptHandler()
        }, 0)

        await handler.execute(uri)

        expect(deps.commands.executeCommand).toHaveBeenCalledWith(
            'vscode.openFolder',
            expect.objectContaining({ fsPath: '/test/website' }),
            { forceNewWindow: true }
        )
    })

    it('should handle Open in Terminal action after creation', async () => {
        const uri = { fsPath: '/test/arch.json', scheme: 'file' } as vscode.Uri
        const mockDocifier = createMockDocifier()
        const mockTerminal = { show: vi.fn(), sendText: vi.fn() }
        ;(deps.docifierFactory.create as Mock).mockReturnValue(mockDocifier)
        ;(deps.window.withProgress as Mock).mockImplementation(async (options, task) => {
            return await task({ report: vi.fn() })
        })
        ;(deps.window.showInformationMessage as Mock).mockResolvedValue('Open in Terminal')
        ;(deps.window.createTerminal as Mock).mockReturnValue(mockTerminal)

        setTimeout(async () => {
            mockQuickPick.selectedItems = [{ id: 'create' }]
            await acceptHandler()
        }, 0)

        await handler.execute(uri)

        expect(deps.window.createTerminal).toHaveBeenCalledWith({
            name: 'CALM Website',
            cwd: '/test/website'
        })
        expect(mockTerminal.show).toHaveBeenCalled()
        expect(mockTerminal.sendText).toHaveBeenCalledWith('npm install && npm start')
    })
})

describe('createCreateWebsiteCommand', () => {
    let deps: Dependencies

    beforeEach(() => {
        deps = createMockDependencies()
    })

    it('should register calm.createWebsite command when passed Dependencies', () => {
        createCreateWebsiteCommand(deps)

        expect(deps.commands.registerCommand).toHaveBeenCalledWith(
            'calm.createWebsite',
            expect.any(Function)
        )
    })

    it('should show error message when command throws', async () => {
        const mockError = new Error('Test error')
        ;(deps.window.showOpenDialog as Mock).mockRejectedValue(mockError)

        createCreateWebsiteCommand(deps)
        const callback = (deps.commands.registerCommand as Mock).mock.calls[0][1]

        await callback()

        expect(deps.window.showErrorMessage).toHaveBeenCalledWith('Failed to create website: Test error')
    })

    it('should handle non-Error objects in catch block', async () => {
        ;(deps.window.showOpenDialog as Mock).mockRejectedValue('string error')

        createCreateWebsiteCommand(deps)
        const callback = (deps.commands.registerCommand as Mock).mock.calls[0][1]

        await callback()

        expect(deps.window.showErrorMessage).toHaveBeenCalledWith('Failed to create website: Unknown error')
    })
})
