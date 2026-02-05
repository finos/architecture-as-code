import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CalmSchemaRegistry } from './calm-schema-registry'
import type { Logger } from '../ports/logger'
import type { Config } from '../ports/config'

// Mock vscode module
vi.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
        fs: {
            readDirectory: vi.fn(),
            readFile: vi.fn()
        }
    },
    Uri: {
        file: vi.fn((path: string) => ({ fsPath: path })),
        joinPath: vi.fn((_base: any, ...parts: string[]) => ({ fsPath: `${_base.fsPath}/${parts.join('/')}` }))
    },
    FileType: {
        File: 1,
        Directory: 2
    }
}))

describe('CalmSchemaRegistry', () => {
    let registry: CalmSchemaRegistry
    let mockLogger: Logger
    let mockConfig: Config
    let mockExtensionUri: any

    beforeEach(() => {
        vi.clearAllMocks()

        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        }

        mockConfig = {
            filesGlobs: vi.fn(() => []),
            templateGlobs: vi.fn(() => []),
            previewLayout: vi.fn(() => 'dagre'),
            showLabels: vi.fn(() => true),
            urlMapping: vi.fn(() => undefined),
            schemaAdditionalFolders: vi.fn(() => [])
        }

        mockExtensionUri = { fsPath: '/extension' }

        registry = new CalmSchemaRegistry(mockExtensionUri, mockLogger, mockConfig)
    })

    describe('isKnownCalmSchema', () => {
        it('should recognize CALM release schema URLs', () => {
            expect(registry.isKnownCalmSchema('https://calm.finos.org/release/1.1/meta/calm.json')).toBe(true)
            expect(registry.isKnownCalmSchema('https://calm.finos.org/release/1.0/meta/calm.json')).toBe(true)
        })

        it('should recognize CALM draft schema URLs', () => {
            expect(registry.isKnownCalmSchema('https://calm.finos.org/draft/2025-03/meta/calm.json')).toBe(true)
        })

        it('should recognize other CALM meta schema files', () => {
            expect(registry.isKnownCalmSchema('https://calm.finos.org/release/1.1/meta/core.json')).toBe(true)
            expect(registry.isKnownCalmSchema('https://calm.finos.org/release/1.1/meta/flow.json')).toBe(true)
        })

        it('should not recognize non-CALM URLs', () => {
            expect(registry.isKnownCalmSchema('https://json-schema.org/draft/2020-12/schema')).toBe(false)
            expect(registry.isKnownCalmSchema('https://example.com/schema.json')).toBe(false)
        })

        it('should not recognize URLs with wrong path structure', () => {
            expect(registry.isKnownCalmSchema('https://calm.finos.org/other/path/schema.json')).toBe(false)
        })
    })

    describe('reset', () => {
        it('should clear schemas and mark as not initialized', async () => {
            // First initialize
            const vscode = await import('vscode')
            vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([])

            await registry.initialize()

            // Then reset
            registry.reset()

            // getRegisteredSchemaUrls should be empty after reset
            expect(registry.getRegisteredSchemaUrls()).toHaveLength(0)
        })
    })

    describe('getSchemaPath', () => {
        it('should return undefined for unregistered schemas', () => {
            expect(registry.getSchemaPath('https://calm.finos.org/release/1.1/meta/calm.json')).toBeUndefined()
        })
    })

    describe('getRegisteredSchemaUrls', () => {
        it('should return empty array initially', () => {
            expect(registry.getRegisteredSchemaUrls()).toEqual([])
        })
    })

    describe('initialize', () => {
        it('should load schemas from bundled directory', async () => {
            const vscode = await import('vscode')

            // Mock directory structure: dist/calm/release/1.1/meta/calm.json
            vi.mocked(vscode.workspace.fs.readDirectory)
                .mockResolvedValueOnce([['release', 2]]) // dist/calm
                .mockResolvedValueOnce([['1.1', 2]]) // dist/calm/release
                .mockResolvedValueOnce([['meta', 2]]) // dist/calm/release/1.1
                .mockResolvedValueOnce([['calm.json', 1]]) // dist/calm/release/1.1/meta

            vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
                Buffer.from(JSON.stringify({
                    $id: 'https://calm.finos.org/release/1.1/meta/calm.json',
                    title: 'CALM Schema'
                }))
            )

            await registry.initialize()

            expect(registry.getSchemaPath('https://calm.finos.org/release/1.1/meta/calm.json')).toBeDefined()
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('initialized with'))
        })

        it('should handle missing directories gracefully', async () => {
            const vscode = await import('vscode')

            vi.mocked(vscode.workspace.fs.readDirectory).mockRejectedValue(new Error('Directory not found'))

            await registry.initialize()

            // Should not throw - silently handles missing directory
            expect(registry.getRegisteredSchemaUrls()).toHaveLength(0)
        })

        it('should only initialize once', async () => {
            const vscode = await import('vscode')
            vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([])

            await registry.initialize()
            await registry.initialize()

            // readDirectory should only be called for the first initialization
            expect(vscode.workspace.fs.readDirectory).toHaveBeenCalledTimes(1)
        })

        it('should load schemas from additional folders', async () => {
            const vscode = await import('vscode')

            // Configure additional folders
            vi.mocked(mockConfig.schemaAdditionalFolders).mockReturnValue(['my-schemas'])

            // Mock bundled schemas directory (empty)
            vi.mocked(vscode.workspace.fs.readDirectory)
                .mockResolvedValueOnce([]) // dist/calm (empty)
                .mockResolvedValueOnce([['custom.json', 1]]) // my-schemas

            vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
                Buffer.from(JSON.stringify({
                    $id: 'https://my-org.com/schemas/custom.json',
                    title: 'Custom Schema'
                }))
            )

            await registry.initialize()

            expect(registry.getSchemaPath('https://my-org.com/schemas/custom.json')).toBeDefined()
        })
    })
})
