import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ValidationService } from './validation-service'
import type { Logger } from '../../core/ports/logger'
import type { Config } from '../../core/ports/config'
import { ValidationOutcome, ValidationOutput } from '@finos/calm-shared'

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
        textDocuments: [],
        asRelativePath: vi.fn((uri: any) => typeof uri === 'string' ? uri : uri.fsPath),
        workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
        fs: {
            readFile: vi.fn()
        }
    },
    Uri: {
        file: vi.fn((path: string) => ({ fsPath: path })),
        joinPath: vi.fn((_base: any, path: string) => ({ fsPath: `/workspace/${path}` }))
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
            urlMapping: vi.fn(() => undefined)
        }

        service = new ValidationService(mockLogger, mockConfig)
    })

    describe('constructor', () => {
        it('should create a diagnostic collection', async () => {
            const vscode = await import('vscode')
            expect(vscode.languages.createDiagnosticCollection).toHaveBeenCalledWith('calm')
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
                lineAt: () => ({ text: '' })
            })
            expect(diagnostic.severity).toBe(1) // DiagnosticSeverity.Warning
        })

        it('should map info severity correctly', () => {
            const output = new ValidationOutput('test', 'information', 'Test info', '/path')
            const diagnostic = (service as any).convertOutputToDiagnostic(output, {
                getText: () => '{}',
                lineAt: () => ({ text: '' })
            })
            expect(diagnostic.severity).toBe(2) // DiagnosticSeverity.Information
        })

        it('should default to error for unknown severity', () => {
            const output = new ValidationOutput('test', 'unknown', 'Test', '/path')
            const diagnostic = (service as any).convertOutputToDiagnostic(output, {
                getText: () => '{}',
                lineAt: () => ({ text: '' })
            })
            expect(diagnostic.severity).toBe(0) // DiagnosticSeverity.Error
        })
    })

    describe('isCalmDocument', () => {
        it('should return false for non-JSON documents', () => {
            const doc = { languageId: 'typescript' }
            const result = (service as any).isCalmDocument(doc)
            expect(result).toBe(false)
        })

        it('should return true for JSON files matching glob pattern', () => {
            const doc = {
                languageId: 'json',
                uri: { fsPath: 'calm/test.json' }
            }
            const result = (service as any).isCalmDocument(doc)
            expect(result).toBe(true)
        })

        it('should return false for JSON files not matching glob pattern', () => {
            const doc = {
                languageId: 'json',
                uri: { fsPath: 'package.json' }
            }
            const result = (service as any).isCalmDocument(doc)
            expect(result).toBe(false)
        })
    })

    describe('matchGlob', () => {
        it('should match simple glob patterns', () => {
            const result = (service as any).matchGlob('calm/test.json', 'calm/*.json')
            expect(result).toBe(true)
        })

        it('should match double-star glob patterns', () => {
            // The ** pattern matches any path segments including empty
            const result = (service as any).matchGlob('calm/nested/test.json', 'calm/**/*.json')
            expect(result).toBe(true)
        })

        it('should not match non-matching paths', () => {
            const result = (service as any).matchGlob('other/test.json', 'calm/**/*.json')
            expect(result).toBe(false)
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
                lineAt: () => ({ text: '' })
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
                lineAt: () => ({ text: '' })
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
})
