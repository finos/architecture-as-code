import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ValidationService } from './validation-service'
import type { Logger } from '../../core/ports/logger'
import type { Config } from '../../core/ports/config'
import { ValidationOutcome, ValidationOutput } from '@finos/calm-shared'
import { TEST_ALL_SCHEMA } from '../../test/test-utils'

/**
 * Known CALM schema URL pattern (mirrors the pattern in calm-schema-registry.ts).
 * Matches URLs like:
 * - https://calm.finos.org/release/1.1/meta/calm.json
 * - https://calm.finos.org/draft/2025-03/meta/calm.json
 * 
 * Uses vi.hoisted() to ensure the pattern is available before vi.mock hoisting.
 */
const { CALM_SCHEMA_URL_PATTERN } = vi.hoisted(() => ({
    CALM_SCHEMA_URL_PATTERN: /^https:\/\/calm\.finos\.org\/(release|draft)\/([^/]+)\/meta\/(.+\.json)$/
}))

// Mock vscode module
vi.mock('vscode', () => ({
    languages: {
        createDiagnosticCollection: vi.fn(() => ({
            set: vi.fn(),
            delete: vi.fn(),
            clear: vi.fn(),
            dispose: vi.fn()
        }))
    },
    workspace: {
        onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
        onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
        onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
        textDocuments: [],
        asRelativePath: vi.fn((uri: any) => typeof uri === 'string' ? uri : uri.fsPath),
        workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
        fs: {
            readFile: vi.fn(),
            readDirectory: vi.fn(() => Promise.resolve([]))
        }
    },
    Uri: {
        file: vi.fn((path: string) => ({ fsPath: path })),
        joinPath: vi.fn((_base: any, ...parts: string[]) => ({ fsPath: `/workspace/${parts.join('/')}` }))
    },
    FileType: {
        File: 1,
        Directory: 2
    },
    Diagnostic: vi.fn().mockImplementation((range, message, severity) => ({
        range,
        message,
        severity,
        source: undefined,
        code: undefined
    })),
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3
    },
    Range: vi.fn().mockImplementation((startLine, startChar, endLine, endChar) => ({
        start: { line: startLine, character: startChar },
        end: { line: endLine, character: endChar }
    }))
}))

// Mock @finos/calm-shared
vi.mock('@finos/calm-shared', async () => {
    const actual = await vi.importActual('@finos/calm-shared')
    return {
        ...actual,
        validate: vi.fn(),
        loadArchitectureAndPattern: vi.fn(),
        loadTimeline: vi.fn(),
        SchemaDirectory: vi.fn().mockImplementation(() => ({
            loadSchemas: vi.fn()
        }))
    }
})

// Mock document loader
vi.mock('@finos/calm-shared/dist/document-loader/document-loader', () => ({
    buildDocumentLoader: vi.fn(() => ({
        loadMissingDocument: vi.fn(),
        initialise: vi.fn()
    }))
}))

// Mock CalmSchemaRegistry
vi.mock('../../core/services/calm-schema-registry', () => ({
    CalmSchemaRegistry: vi.fn().mockImplementation(() => ({
        initialize: vi.fn(),
        reset: vi.fn(),
        isKnownCalmSchema: vi.fn((url: string) => CALM_SCHEMA_URL_PATTERN.test(url)),
        getSchemaPath: vi.fn(),
        getRegisteredSchemaUrls: vi.fn(() => [])
    }))
}))

// Mock detectCalmTimeline from model module (uses in-memory text, not filesystem)
const { mockDetectCalmTimeline } = vi.hoisted(() => ({
    mockDetectCalmTimeline: vi.fn()
}))

vi.mock('../../models/model', () => ({
    detectCalmTimeline: mockDetectCalmTimeline
}))


describe('ValidationService', () => {
    let service: ValidationService
    let mockLogger: Logger
    let mockConfig: Config

    beforeEach(() => {
        vi.clearAllMocks()

        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        }

        mockConfig = {
            filesGlobs: vi.fn(() => ['calm/*.json', 'calm/**/*.json']),
            templateGlobs: vi.fn(() => ['**/*.md']),
            previewLayout: vi.fn(() => 'dagre'),
            showLabels: vi.fn(() => true),
            urlMapping: vi.fn(() => undefined),
            schemaAdditionalFolders: vi.fn(() => []),
            docifyTheme: vi.fn(() => 'auto')
        }

        service = new ValidationService(mockLogger, mockConfig)
    })

    describe('constructor', () => {
        it('should create a diagnostic collection', async () => {
            const vscode = await import('vscode')
            expect(vscode.languages.createDiagnosticCollection).toHaveBeenCalledWith('calm')
        })
    })

    describe('extractSchemaUrl', () => {
        it.each(TEST_ALL_SCHEMA)('should extract $schema from valid JSON document with CALM %s schema', (schema) => {
            const doc = {
                languageId: 'json',
                getText: () => JSON.stringify({ $schema: `https://calm.finos.org/release/${schema}/meta/calm.json` })
            }
            const result = (service as any).extractSchemaUrl(doc)
            expect(result).toBe(`https://calm.finos.org/release/${schema}/meta/calm.json`)
        })

        it('should return undefined for JSON without $schema', () => {
            const doc = {
                languageId: 'json',
                getText: () => JSON.stringify({ nodes: [] })
            }
            const result = (service as any).extractSchemaUrl(doc)
            expect(result).toBeUndefined()
        })

        it('should return undefined for invalid JSON', () => {
            const doc = {
                languageId: 'json',
                getText: () => 'not valid json'
            }
            const result = (service as any).extractSchemaUrl(doc)
            expect(result).toBeUndefined()
        })
    })

    describe('mapSeverity', () => {
        it('should map error severity correctly', () => {
            const output = new ValidationOutput('test', 'error', 'Test error', '/path')
            const diagnostic = (service as any).convertOutputToDiagnostic(output, {
                getText: () => '{}',
                lineAt: () => ({ text: '' })
            })
            expect(diagnostic.severity).toBe(0) // DiagnosticSeverity.Error
        })

        it('should map warning severity correctly', () => {
            const output = new ValidationOutput('test', 'warning', 'Test warning', '/path')
            const diagnostic = (service as any).convertOutputToDiagnostic(output, {
                getText: () => '{}',
                lineAt: () => ({ text: '' }),
                positionAt: () => ({ line: 0, character: 0, translate: () => ({ line: 0, character: 0 }) })
            })
            expect(diagnostic.severity).toBe(1) // DiagnosticSeverity.Warning
        })

        it('should map info severity correctly', () => {
            const output = new ValidationOutput('test', 'information', 'Test info', '/path')
            const diagnostic = (service as any).convertOutputToDiagnostic(output, {
                getText: () => '{}',
                lineAt: () => ({ text: '' }),
                positionAt: () => ({ line: 0, character: 0, translate: () => ({ line: 0, character: 0 }) })
            })
            expect(diagnostic.severity).toBe(2) // DiagnosticSeverity.Information
        })

        it('should default to error for unknown severity', () => {
            const output = new ValidationOutput('test', 'unknown', 'Test', '/path')
            const diagnostic = (service as any).convertOutputToDiagnostic(output, {
                getText: () => '{}',
                lineAt: () => ({ text: '' }),
                positionAt: () => ({ line: 0, character: 0, translate: () => ({ line: 0, character: 0 }) })
            })
            expect(diagnostic.severity).toBe(0) // DiagnosticSeverity.Error
        })
    })

    describe('convertToDiagnostics', () => {
        it('should convert ValidationOutcome to diagnostics', () => {
            const outputs = [
                new ValidationOutput('rule1', 'error', 'Error message', '/nodes/0'),
                new ValidationOutput('rule2', 'warning', 'Warning message', '/relationships/0')
            ]
            const outcome = new ValidationOutcome(outputs, [], true, true)

            const mockDoc = {
                getText: () => '{"nodes": [], "relationships": []}',
                lineAt: () => ({ text: '' }),
                positionAt: () => ({ line: 0, character: 0, translate: () => ({ line: 0, character: 0 }) })
            }

            const diagnostics = (service as any).convertToDiagnostics(outcome, mockDoc)
            expect(diagnostics).toHaveLength(2)
            expect(diagnostics[0].message).toBe('Error message')
            expect(diagnostics[1].message).toBe('Warning message')
        })

        it('should handle empty ValidationOutcome', () => {
            const outcome = new ValidationOutcome([], [], false, false)

            const mockDoc = {
                getText: () => '{}',
                lineAt: () => ({ text: '' }),
                positionAt: () => ({ line: 0, character: 0, translate: () => ({ line: 0, character: 0 }) })
            }

            const diagnostics = (service as any).convertToDiagnostics(outcome, mockDoc)
            expect(diagnostics).toHaveLength(0)
        })
    })

    describe('convertOutputToDiagnostic', () => {
        it('should use line numbers when provided', () => {
            const output = new ValidationOutput(
                'test',
                'error',
                'Test error',
                '/path',
                undefined,
                5,  // line_start (1-based)
                5,  // line_end
                10, // char_start
                20  // char_end
            )

            const mockDoc = {
                getText: () => '{}',
                lineAt: () => ({ text: '                    ' })
            }

            const diagnostic = (service as any).convertOutputToDiagnostic(output, mockDoc)
            // Line should be 0-based in the Range (5-1 = 4)
            expect(diagnostic.range.start.line).toBe(4)
            expect(diagnostic.range.end.line).toBe(4)
            expect(diagnostic.range.start.character).toBe(10)
            expect(diagnostic.range.end.character).toBe(20)
        })

        it('should fall back to finding path in document when no line numbers', () => {
            const output = new ValidationOutput('test', 'error', 'Test error', '/nodes')

            const mockDoc = {
                getText: () => '{"nodes": []}',
                positionAt: (index: number) => ({ line: 0, character: index, translate: () => ({ line: 0, character: index + 7 }) }),
                lineAt: () => ({ text: '' })
            }

            const diagnostic = (service as any).convertOutputToDiagnostic(output, mockDoc)
            expect(diagnostic).toBeDefined()
            expect(diagnostic.message).toBe('Test error')
        })
    })

    describe('dispose', () => {
        it('should dispose all disposables', () => {
            service.dispose()
            // Should not throw
        })
    })

    describe('clearAll', () => {
        it('should clear all diagnostics', () => {
            service.clearAll()
            // Should not throw
        })
    })

    describe('validateDocument file type detection', () => {
        it('should validate timeline files using loadTimeline when detectCalmTimeline returns true', async () => {
            // detectCalmTimeline works on in-memory text content, not filesystem
            mockDetectCalmTimeline.mockReturnValue(true)

            const timelineContent = JSON.stringify({
                $schema: 'https://calm.finos.org/release/1.2/meta/calm-timeline.json',
                moments: []
            })

            const mockDoc = {
                uri: { fsPath: '/test/timeline.json', toString: () => '/test/timeline.json' },
                getText: () => timelineContent,
                languageId: 'json',
                lineAt: () => ({ text: '' })
            }

            // Timeline files should be validated using loadTimeline
            try {
                await service.validateDocument(mockDoc as any)
            } catch {
                // Expected - other mocks may not be set up
            }

            // detectCalmTimeline should be called with the document text content
            expect(mockDetectCalmTimeline).toHaveBeenCalledWith(timelineContent)

            // For timeline files, we should log that we're validating a timeline
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Validating timeline file'))
        })

        it('should validate architecture files using loadArchitectureAndPattern when detectCalmTimeline returns false', async () => {
            // detectCalmTimeline returns false for architecture files
            mockDetectCalmTimeline.mockReturnValue(false)

            const architectureContent = JSON.stringify({
                $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
                nodes: []
            })

            const mockDoc = {
                uri: { fsPath: '/test/architecture.json', toString: () => '/test/architecture.json' },
                getText: () => architectureContent,
                languageId: 'json',
                lineAt: () => ({ text: '' })
            }

            // Architecture files should proceed with validation
            try {
                await service.validateDocument(mockDoc as any)
            } catch {
                // Expected - other mocks may not be set up
            }

            // detectCalmTimeline should be called with document text content
            expect(mockDetectCalmTimeline).toHaveBeenCalledWith(architectureContent)
            // Should NOT log the timeline validation message for architecture files
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining('Validating timeline file'))
        })
    })
})
