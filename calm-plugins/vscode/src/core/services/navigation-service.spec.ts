import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NavigationService } from './navigation-service'
import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import { buildDocumentLoader } from '@finos/calm-shared'

// Mock vscode
vi.mock('vscode', () => ({
    workspace: {
        workspaceFolders: undefined as { uri: { fsPath: string } }[] | undefined,
        openTextDocument: vi.fn(),
    },
    window: {
        activeTextEditor: undefined,
        showTextDocument: vi.fn(),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn().mockResolvedValue(undefined),
        showErrorMessage: vi.fn(),
    },
    Uri: {
        file: vi.fn((f) => ({ fsPath: f })),
    },
    ViewColumn: {
        One: 1,
    },
    commands: {
        executeCommand: vi.fn(),
    },
}))

// Mock fs
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    promises: {
        readFile: vi.fn()
    }
}))

// Mock document loader
vi.mock('@finos/calm-shared/dist/document-loader/document-loader', () => ({
    buildDocumentLoader: vi.fn(),
}))

describe('NavigationService', () => {
    let navigationService: NavigationService
    let mockLogger: any
    let mockConfig: any
    let mockDocLoader: any

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }

        mockConfig = {
            urlMapping: vi.fn(),
        }

        mockDocLoader = {
            resolvePath: vi.fn(),
        }

        vi.mocked(buildDocumentLoader).mockReturnValue(mockDocLoader)
        
        // Reset vscode mocks
        // @ts-ignore
        vscode.workspace.workspaceFolders = undefined

        navigationService = new NavigationService(mockLogger, mockConfig)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('reset', () => {
        it('should clear internal state', () => {
            navigationService.reset()
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Configuration reset'))
        })
    })

    describe('navigate', () => {
        it('should return false if node has no detailed-architecture', async () => {
            const result = await navigationService.navigate('node1', { id: 'node1' })
            expect(result).toBe(false)
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('has no detailed-architecture'))
        })

        it('should return false if workspace is not open (loader not initialized)', async () => {
            // Ensure no workspace folders
            // @ts-ignore
            vscode.workspace.workspaceFolders = undefined

            const result = await navigationService.navigate('node1', { 
                'detailed-architecture': 'detail.json' 
            })

            expect(result).toBe(false)
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('DocumentLoader not initialized'))
        })

        it('should initialize loader and navigate successfully', async () => {
            // Setup workspace
            const workspacePath = '/workspace'
            // @ts-ignore
            vscode.workspace.workspaceFolders = [{ uri: { fsPath: workspacePath } }]

            // Setup file existence
            const targetPath = '/workspace/detail.json'
            mockDocLoader.resolvePath.mockReturnValue(targetPath)
            vi.mocked(fs.existsSync).mockReturnValue(true)
            
            // Setup open document
            const mockDoc = { uri: { fsPath: targetPath } }
            vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDoc as any)

            // Use absolute path to avoid relative path handling
            const result = await navigationService.navigate('node1', {
                'detailed-architecture': '/workspace/detail.json'
            })

            expect(buildDocumentLoader).toHaveBeenCalledWith(expect.objectContaining({
                basePath: workspacePath
            }))
            expect(mockDocLoader.resolvePath).toHaveBeenCalledWith('/workspace/detail.json')
            expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ fsPath: targetPath }))
            expect(vscode.window.showTextDocument).toHaveBeenCalledWith(mockDoc, expect.objectContaining({
                viewColumn: 1,
                preview: false
            }))
            expect(result).toBe(true)
        })

        it('should handle missing target file', async () => {
            // Setup workspace
            const workspacePath = '/workspace'
            // @ts-ignore
            vscode.workspace.workspaceFolders = [{ uri: { fsPath: workspacePath } }]

            // Setup file missing
            const targetPath = '/workspace/detail.json'
            mockDocLoader.resolvePath.mockReturnValue(targetPath)
            vi.mocked(fs.existsSync).mockReturnValue(false)

            const result = await navigationService.navigate('node1', { 
                'detailed-architecture': 'detail.json' 
            })

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('File not found'))
            expect(result).toBe(false)
        })

        it('should suggest mapping for HTTP URLs when file not found', async () => {
            // Setup workspace
            const workspacePath = '/workspace'
            // @ts-ignore
            vscode.workspace.workspaceFolders = [{ uri: { fsPath: workspacePath } }]

            const httpUrl = 'http://example.com/arch.json'
            mockDocLoader.resolvePath.mockReturnValue(undefined) // or whatever resolvePath returns for unresolvable
            
            const result = await navigationService.navigate('node1', { 
                'detailed-architecture': httpUrl 
            })

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('Cannot open'),
                expect.anything()
            )
            expect(result).toBe(false)
        })
    })

    describe('URL Mapping', () => {
        it('should load URL mapping from config', async () => {
            // Setup workspace
            const workspacePath = '/workspace'
            // @ts-ignore
            vscode.workspace.workspaceFolders = [{ uri: { fsPath: workspacePath } }]

            // Setup config
            const mappingFile = 'mapping.json'
            mockConfig.urlMapping.mockReturnValue(mappingFile)

            // Setup mapping file
            const resolvedMappingPath = path.join(workspacePath, mappingFile)
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
                'http://example.com': 'local/path'
            }))

            // Trigger initialization via navigate
            await navigationService.navigate('node1', { 'detailed-architecture': 'test.json' })

            expect(fs.promises.readFile).toHaveBeenCalledWith(resolvedMappingPath, 'utf-8')
            expect(buildDocumentLoader).toHaveBeenCalledWith(expect.objectContaining({
                urlToLocalMap: expect.any(Map)
            }))
            
            // Verify map content passed to loader
            const callArgs = vi.mocked(buildDocumentLoader).mock.calls[0][0]
            expect(callArgs.urlToLocalMap?.get('http://example.com')).toContain('local/path')
        })

        it('should handle missing mapping file', async () => {
            // Setup workspace
            const workspacePath = '/workspace'
            // @ts-ignore
            vscode.workspace.workspaceFolders = [{ uri: { fsPath: workspacePath } }]

            mockConfig.urlMapping.mockReturnValue('missing.json')
            const error: any = new Error('ENOENT')
            error.code = 'ENOENT'
            vi.mocked(fs.promises.readFile).mockRejectedValue(error)

            await navigationService.navigate('node1', { 'detailed-architecture': 'test.json' })

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('URL mapping file not found'))
        })

        it('should handle invalid mapping JSON', async () => {
            // Setup workspace
            const workspacePath = '/workspace'
            // @ts-ignore
            vscode.workspace.workspaceFolders = [{ uri: { fsPath: workspacePath } }]

            mockConfig.urlMapping.mockReturnValue('invalid.json')
            vi.mocked(fs.promises.readFile).mockResolvedValue('{ invalid json')

            await navigationService.navigate('node1', { 'detailed-architecture': 'test.json' })

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid JSON in URL mapping file'))
        })
    })
})
