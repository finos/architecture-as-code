import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import * as vscode from 'vscode'
import { PostCreationHandler } from './post-creation-handler'
import { createMockWindow, createMockCommands } from './test-utils'

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

describe('PostCreationHandler', () => {
    let mockWindow: typeof vscode.window
    let mockCommands: typeof vscode.commands
    let handler: PostCreationHandler

    beforeEach(() => {
        mockWindow = createMockWindow()
        mockCommands = createMockCommands()
        handler = new PostCreationHandler(mockWindow, mockCommands)
    })

    it('should show success message with options', async () => {
        ;(mockWindow.showInformationMessage as Mock).mockResolvedValue(undefined)

        await handler.handle('/test/output')

        expect(mockWindow.showInformationMessage).toHaveBeenCalledWith(
            'Website scaffold created at: /test/output',
            'Open Folder',
            'Open in Terminal'
        )
    })

    it('should open folder when "Open Folder" is selected', async () => {
        ;(mockWindow.showInformationMessage as Mock).mockResolvedValue('Open Folder')

        await handler.handle('/test/output')

        expect(mockCommands.executeCommand).toHaveBeenCalledWith(
            'vscode.openFolder',
            expect.objectContaining({ fsPath: '/test/output' }),
            { forceNewWindow: true }
        )
    })

    it('should open terminal when "Open in Terminal" is selected', async () => {
        const mockTerminal = { show: vi.fn(), sendText: vi.fn() }
        ;(mockWindow.showInformationMessage as Mock).mockResolvedValue('Open in Terminal')
        ;(mockWindow.createTerminal as Mock).mockReturnValue(mockTerminal)

        await handler.handle('/test/output')

        expect(mockWindow.createTerminal).toHaveBeenCalledWith({
            name: 'CALM Website',
            cwd: '/test/output'
        })
        expect(mockTerminal.show).toHaveBeenCalled()
        expect(mockTerminal.sendText).toHaveBeenCalledWith('npm install && npm start')
    })

    it('should do nothing when dialog is dismissed', async () => {
        ;(mockWindow.showInformationMessage as Mock).mockResolvedValue(undefined)

        await handler.handle('/test/output')

        expect(mockCommands.executeCommand).not.toHaveBeenCalled()
        expect(mockWindow.createTerminal).not.toHaveBeenCalled()
    })
})
