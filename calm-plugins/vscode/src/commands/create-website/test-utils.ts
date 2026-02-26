import { vi } from 'vitest'
import * as vscode from 'vscode'
import * as fs from 'fs'
import { Dependencies } from './types'
import { IDocifierFactory, IDocifier } from '../../cli/docifier-factory'

export function createMockWindow(): typeof vscode.window {
    return {
        activeTextEditor: undefined,
        showOpenDialog: vi.fn(),
        showInputBox: vi.fn(),
        showInformationMessage: vi.fn(),
        showErrorMessage: vi.fn(),
        createQuickPick: vi.fn(),
        withProgress: vi.fn(),
        createTerminal: vi.fn()
    } as unknown as typeof vscode.window
}

export function createMockCommands(): typeof vscode.commands {
    return {
        registerCommand: vi.fn((command: string, callback: Function) => ({
            command,
            callback,
            dispose: vi.fn()
        })),
        executeCommand: vi.fn()
    } as unknown as typeof vscode.commands
}

export function createMockFs(): typeof fs {
    return {
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => ''),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn()
    } as unknown as typeof fs
}

export function createMockDocifier(): IDocifier {
    return {
        docify: vi.fn().mockResolvedValue(undefined)
    }
}

export function createMockDocifierFactory(mockDocifier?: IDocifier): IDocifierFactory {
    return {
        create: vi.fn().mockReturnValue(mockDocifier ?? createMockDocifier())
    }
}

export function createMockDependencies(overrides?: Partial<Dependencies>): Dependencies {
    return {
        window: createMockWindow(),
        commands: createMockCommands(),
        fs: createMockFs(),
        docifierFactory: createMockDocifierFactory(),
        extensionPath: '/test/extension',
        ...overrides
    }
}