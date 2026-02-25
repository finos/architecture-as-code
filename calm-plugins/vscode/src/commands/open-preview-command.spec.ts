import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as vscode from 'vscode'
import { createOpenPreviewCommand } from './open-preview-command'
import { FileType } from '../models/file-types'
import type { ApplicationStoreApi, ApplicationStore } from '../application-store'

// Mock vscode module
vi.mock('vscode', () => ({
    commands: {
        registerCommand: vi.fn((command: string, callback: Function) => {
            return { command, callback }
        })
    },
    window: {
        activeTextEditor: undefined,
        showWarningMessage: vi.fn()
    },
    Uri: {
        file: (path: string) => ({ fsPath: path, scheme: 'file' })
    }
}))

// Mock file-types module
vi.mock('../models/file-types', () => ({
    detectFileType: vi.fn(),
    FileType: {
        ArchitectureFile: 'architecture',
        TemplateFile: 'template',
        Unknown: 'unknown'
    }
}))

import { detectFileType } from '../models/file-types'

describe('createOpenPreviewCommand', () => {
    let mockStore: ApplicationStoreApi
    let mockState: ApplicationStore
    let commandCallback: Function

    beforeEach(() => {
        vi.clearAllMocks()

        mockState = {
            currentModelIndex: undefined,
            currentDocumentUri: undefined,
            isTemplateMode: false,
            templateFilePath: undefined,
            architectureFilePath: undefined,
            selectedElementId: undefined,
            searchFilter: '',
            showLabels: true,
            forceCreatePreview: false,
            setModelIndex: vi.fn(),
            setCurrentDocument: vi.fn(),
            setTemplateMode: vi.fn(),
            setSelectedElement: vi.fn(),
            setSearchFilter: vi.fn(),
            setShowLabels: vi.fn(),
            setForceCreatePreview: vi.fn(),
            clearSelection: vi.fn(),
            resetDocument: vi.fn()
        }

        mockStore = {
            getState: vi.fn(() => mockState),
            setState: vi.fn(),
            subscribe: vi.fn(() => vi.fn()),
            getInitialState: vi.fn(() => mockState)
        }

        const result = createOpenPreviewCommand(mockStore)
        commandCallback = (result as any).callback
    })

    describe('elementId parameter handling', () => {
        beforeEach(() => {
            // Setup valid editor and architecture file
            const mockUri = { fsPath: '/test/file.json', scheme: 'file' }
            const mockDocument = { uri: mockUri }
            ;(vscode.window as any).activeTextEditor = { document: mockDocument }
            ;(detectFileType as any).mockReturnValue({ 
                type: FileType.ArchitectureFile, 
                isValid: true 
            })
        })

        it('should set selected element when elementId is a valid string', async () => {
            await commandCallback('node-123')

            expect(mockState.setSelectedElement).toHaveBeenCalledWith('node-123')
        })

        it('should not set selected element when elementId is undefined', async () => {
            await commandCallback(undefined)

            expect(mockState.setSelectedElement).not.toHaveBeenCalled()
        })

        it('should not set selected element when elementId is a Uri object (context menu case)', async () => {
            // When invoked from context menu, VS Code passes a Uri object
            const uriObject = { fsPath: '/some/path', scheme: 'file' }
            
            await commandCallback(uriObject)

            expect(mockState.setSelectedElement).not.toHaveBeenCalled()
        })

        it('should not set selected element when elementId is an empty string', async () => {
            await commandCallback('')

            expect(mockState.setSelectedElement).not.toHaveBeenCalled()
        })

        it('should still open preview even when elementId is invalid type', async () => {
            const uriObject = { fsPath: '/some/path', scheme: 'file' }
            
            await commandCallback(uriObject)

            expect(mockState.setCurrentDocument).toHaveBeenCalled()
            expect(mockState.setForceCreatePreview).toHaveBeenCalledWith(true)
        })
    })

    describe('editor validation', () => {
        it('should return early when no active editor', async () => {
            ;(vscode.window as any).activeTextEditor = undefined

            await commandCallback('element-id')

            expect(mockState.setCurrentDocument).not.toHaveBeenCalled()
        })
    })

    describe('file type validation', () => {
        beforeEach(() => {
            const mockUri = { fsPath: '/test/file.json', scheme: 'file' }
            const mockDocument = { uri: mockUri }
            ;(vscode.window as any).activeTextEditor = { document: mockDocument }
        })

        it('should show warning for non-CALM files', async () => {
            ;(detectFileType as any).mockReturnValue({ 
                type: FileType.Unknown, 
                isValid: false 
            })

            await commandCallback()

            expect(vscode.window.showWarningMessage).toHaveBeenCalled()
            expect(mockState.setCurrentDocument).not.toHaveBeenCalled()
        })

        it('should process valid architecture files', async () => {
            ;(detectFileType as any).mockReturnValue({ 
                type: FileType.ArchitectureFile, 
                isValid: true 
            })

            await commandCallback()

            expect(mockState.setCurrentDocument).toHaveBeenCalled()
            expect(mockState.setTemplateMode).toHaveBeenCalledWith(false)
            expect(mockState.setForceCreatePreview).toHaveBeenCalledWith(true)
        })

        it('should process valid template files with architecture reference', async () => {
            const mockUri = { fsPath: '/test/template.md', scheme: 'file' }
            const mockDocument = { uri: mockUri }
            ;(vscode.window as any).activeTextEditor = { document: mockDocument }
            ;(detectFileType as any).mockReturnValue({ 
                type: FileType.TemplateFile, 
                isValid: true,
                architecturePath: '/test/arch.json'
            })

            await commandCallback()

            expect(mockState.setCurrentDocument).toHaveBeenCalled()
            expect(mockState.setTemplateMode).toHaveBeenCalledWith(true, '/test/template.md', '/test/arch.json')
            expect(mockState.setForceCreatePreview).toHaveBeenCalledWith(true)
        })
    })
})
