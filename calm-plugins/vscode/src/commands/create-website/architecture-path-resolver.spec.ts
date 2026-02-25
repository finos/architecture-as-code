import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import * as vscode from 'vscode'
import { ArchitecturePathResolver } from './architecture-path-resolver'
import { createMockWindow } from './test-utils'

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

describe('ArchitecturePathResolver', () => {
    let mockWindow: typeof vscode.window
    let resolver: ArchitecturePathResolver

    beforeEach(() => {
        mockWindow = createMockWindow()
        resolver = new ArchitecturePathResolver(mockWindow)
    })

    it('should return fsPath when URI is provided', async () => {
        const uri = { fsPath: '/test/arch.json', scheme: 'file' } as vscode.Uri

        const result = await resolver.resolve(uri)

        expect(result).toBe('/test/arch.json')
    })

    it('should return active editor path for valid architecture file', async () => {
        (mockWindow as any).activeTextEditor = {
            document: {
                uri: { fsPath: '/test/arch.json', scheme: 'file' }
            }
        }

        const result = await resolver.resolve()

        expect(result).toBe('/test/arch.json')
    })

    it('should not return active editor path for non-architecture file', async () => {
        (mockWindow as any).activeTextEditor = {
            document: {
                uri: { fsPath: '/test/file.txt', scheme: 'file' }
            }
        }
        ;(mockWindow.showOpenDialog as Mock).mockResolvedValue(undefined)

        const result = await resolver.resolve()

        expect(result).toBeUndefined()
        expect(mockWindow.showOpenDialog).toHaveBeenCalled()
    })

    it('should show open dialog when no active editor', async () => {
        const selectedFile = { fsPath: '/selected/arch.json' }
        ;(mockWindow.showOpenDialog as Mock).mockResolvedValue([selectedFile])

        const result = await resolver.resolve()

        expect(result).toBe('/selected/arch.json')
        expect(mockWindow.showOpenDialog).toHaveBeenCalledWith({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'Architecture Files': ['json'] },
            title: 'Select CALM Architecture File'
        })
    })

    it('should return undefined when dialog is cancelled', async () => {
        ;(mockWindow.showOpenDialog as Mock).mockResolvedValue(undefined)

        const result = await resolver.resolve()

        expect(result).toBeUndefined()
    })
})
