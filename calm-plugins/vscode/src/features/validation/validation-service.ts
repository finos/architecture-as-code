import * as vscode from 'vscode'
import {
    validate,
    ValidationOutcome,
    ValidationOutput,
    SchemaDirectory,
    loadArchitectureAndPattern
} from '@finos/calm-shared'
import { buildDocumentLoader, DocumentLoader } from '@finos/calm-shared/dist/document-loader/document-loader'
import { parseWithPointers, getLocationForJsonPath } from '@stoplight/json'
import type { Logger } from '../../core/ports/logger'
import type { Config } from '../../core/ports/config'
import { CalmSchemaRegistry } from '../../core/services/calm-schema-registry'

/**
 * Parsed document context with location information for precise error positioning.
 */
interface ParsedDocumentContext {
    data: unknown
    parseResult: ReturnType<typeof parseWithPointers>
}

/**
 * Service that validates CALM documents and reports diagnostics to VS Code.
 * Follows the hexagonal architecture pattern - depends on ports, not VSCode directly
 * (except for the DiagnosticCollection which is the output port).
 * 
 * Documents are identified as CALM files based on their $schema reference pointing
 * to a known CALM schema URL (e.g., https://calm.finos.org/release/1.1/meta/calm.json).
 */
export class ValidationService implements vscode.Disposable {
    private readonly diagnosticCollection: vscode.DiagnosticCollection
    private readonly disposables: vscode.Disposable[] = []
    private schemaRegistry: CalmSchemaRegistry | undefined

    constructor(
        private readonly logger: Logger,
        private readonly config: Config
    ) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('calm')
        this.disposables.push(this.diagnosticCollection)
    }

    /**
     * Register document listeners to trigger validation on save.
     */
    register(context: vscode.ExtensionContext): void {
        // Initialize the schema registry with bundled schemas
        this.schemaRegistry = new CalmSchemaRegistry(context.extensionUri, this.logger, this.config)
        void this.schemaRegistry.initialize()

        // Listen for configuration changes to reset schema registry
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('calm.schemas.additionalFolders')) {
                    this.logger.info?.('[validation] Configuration changed: calm.schemas.additionalFolders - reloading schemas')
                    this.schemaRegistry?.reset()
                    void this.schemaRegistry?.initialize()
                }
            })
        )

        // Validate on save
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(doc => {
                this.logger.info?.(`[validation] Document saved: ${doc.uri.fsPath}`)
                void this.validateIfCalmDocument(doc)
            })
        )

        // Validate when a document is opened
        this.disposables.push(
            vscode.workspace.onDidOpenTextDocument(doc => {
                this.logger.info?.(`[validation] Document opened: ${doc.uri.fsPath}`)
                void this.validateIfCalmDocument(doc)
            })
        )

        // Validate when an editor becomes active (handles reopening cached documents)
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor?.document) {
                    this.logger.info?.(`[validation] Editor activated: ${editor.document.uri.fsPath}`)
                    void this.validateIfCalmDocument(editor.document)
                }
            })
        )

        // Clear diagnostics when document is closed from memory
        this.disposables.push(
            vscode.workspace.onDidCloseTextDocument(doc => {
                this.logger.info?.(`[validation] Document closed from memory: ${doc.uri.fsPath}`)
                this.diagnosticCollection.delete(doc.uri)
                this.logger.info?.(`[validation] Diagnostics cleared for: ${doc.uri.fsPath}`)
            })
        )

        // Clear diagnostics when editor tab is closed (document may still be in memory)
        this.disposables.push(
            vscode.window.tabGroups.onDidChangeTabs(event => {
                for (const closedTab of event.closed) {
                    if (closedTab.input instanceof vscode.TabInputText) {
                        const uri = closedTab.input.uri
                        this.logger.info?.(`[validation] Editor tab closed: ${uri.fsPath}`)
                        this.diagnosticCollection.delete(uri)
                        this.logger.info?.(`[validation] Diagnostics cleared for closed tab: ${uri.fsPath}`)
                    }
                }
            })
        )

        // Validate currently open documents on activation
        this.logger.info?.(`[validation] Validating ${vscode.workspace.textDocuments.length} already-open documents`)
        vscode.workspace.textDocuments.forEach(doc => {
            this.logger.info?.(`[validation] Initial validation: ${doc.uri.fsPath}`)
            void this.validateIfCalmDocument(doc)
        })

        context.subscriptions.push(...this.disposables)
    }

    /**
     * Validate document if it's a CALM document (based on $schema content).
     */
    private async validateIfCalmDocument(doc: vscode.TextDocument): Promise<void> {
        if (doc.languageId !== 'json') {
            return
        }

        const schemaUrl = this.extractSchemaUrl(doc)
        if (!schemaUrl) {
            return
        }

        if (!this.schemaRegistry?.isKnownCalmSchema(schemaUrl)) {
            return
        }

        await this.validateDocument(doc)
    }

    /**
     * Extract the $schema URL from a JSON document.
     */
    private extractSchemaUrl(doc: vscode.TextDocument): string | undefined {
        try {
            const text = doc.getText()
            const json = JSON.parse(text)
            if (json.$schema && typeof json.$schema === 'string') {
                return json.$schema
            }
        } catch {
            // Not valid JSON or no $schema
        }
        return undefined
    }

    /**
     * Validate a CALM document and update diagnostics.
     */
    async validateDocument(doc: vscode.TextDocument): Promise<void> {
        this.logger.info?.(`Validating CALM document: ${doc.uri.fsPath}`)

        try {
            const text = doc.getText()
            
            // Parse with location information for precise error positioning
            let parseContext: ParsedDocumentContext
            try {
                const parseResult = parseWithPointers(text)
                parseContext = {
                    data: parseResult.data,
                    parseResult
                }
            } catch (parseError) {
                // JSON parse error - report it
                const diagnostic = new vscode.Diagnostic(
                    new vscode.Range(0, 0, 0, 0),
                    `Invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                    vscode.DiagnosticSeverity.Error
                )
                diagnostic.source = 'CALM'
                this.diagnosticCollection.set(doc.uri, [diagnostic])
                return
            }

            const architecture = parseContext.data as object

            // Build document loader for resolving patterns
            const docLoader = await this.buildDocumentLoader()
            const schemaDirectory = new SchemaDirectory(docLoader, false)
            await schemaDirectory.loadSchemas()

            // Load architecture and pattern (pattern may be inferred from $schema)
            const { architecture: loadedArch, pattern } = await loadArchitectureAndPattern(
                doc.uri.fsPath,
                undefined, // no explicit pattern path
                docLoader,
                schemaDirectory,
                this.logger as any
            )

            // Run validation
            const outcome = await validate(
                loadedArch || architecture,
                pattern,
                schemaDirectory,
                false // debug
            )

            // Enrich validation outputs with line numbers
            this.enrichWithDocumentPositions(outcome, parseContext)

            // Convert to VS Code diagnostics
            const diagnostics = this.convertToDiagnostics(outcome, doc)
            this.diagnosticCollection.set(doc.uri, diagnostics)

            this.logger.info?.(`Validation complete: ${diagnostics.length} issues found`)
        } catch (error) {
            this.logger.error?.(`Validation failed: ${error instanceof Error ? error.message : String(error)}`)
            // Don't clear diagnostics on error - keep previous results
        }
    }

    /**
     * Enrich validation outputs with line/character positions from the parsed document.
     */
    private enrichWithDocumentPositions(outcome: ValidationOutcome, context: ParsedDocumentContext): void {
        if (!outcome?.allValidationOutputs) {
            return
        }
        const outputs = outcome.allValidationOutputs()
        for (const output of outputs) {
            if (!output.path) {
                continue
            }

            const jsonPath = this.pointerToJsonPath(output.path, context.data)
            if (!jsonPath) {
                continue
            }

            const location = getLocationForJsonPath(context.parseResult, jsonPath)
            if (location?.range) {
                output.line_start = location.range.start.line + 1 // store 1-based
                output.character_start = location.range.start.character
                output.line_end = location.range.end.line + 1 // store 1-based
                output.character_end = location.range.end.character
                this.logger.debug?.(`[validation] Enriched ${output.path}: line ${output.line_start}-${output.line_end}`)
            }
        }
    }

    /**
     * Convert a JSON pointer path to a JSON path array for @stoplight/json.
     * Handles paths like /nodes/0/unique-id or /relationships/user-to-hitl/relationship-type/interacts/actor
     */
    private pointerToJsonPath(pointerPath: string, data?: unknown): Array<string | number> | undefined {
        if (!pointerPath || pointerPath[0] !== '/') {
            return undefined
        }

        const segments = pointerPath.slice(1).split('/')
        const jsonPath: Array<string | number> = []

        let current: unknown = data
        for (const segment of segments) {
            // Check if segment is a numeric index or a property name that should be resolved
            if (/^\d+$/.test(segment)) {
                jsonPath.push(parseInt(segment, 10))
            } else if (this.isRecord(current) && Array.isArray(current[jsonPath[jsonPath.length - 1] as keyof typeof current])) {
                // Previous segment was an array - try to find element by unique-id
                const arr = current[jsonPath[jsonPath.length - 1] as keyof typeof current] as unknown[]
                const idx = arr.findIndex(el => this.isRecord(el) && el['unique-id'] === segment)
                if (idx >= 0) {
                    jsonPath.push(idx)
                } else {
                    jsonPath.push(segment)
                }
            } else {
                jsonPath.push(segment)
            }

            // Navigate for next iteration
            if (this.isRecord(current)) {
                const lastKey = jsonPath[jsonPath.length - 1]
                current = current[lastKey as keyof typeof current]
            }
        }

        return jsonPath
    }

    private isRecord(obj: unknown): obj is Record<string, unknown> {
        return typeof obj === 'object' && obj !== null
    }

    /**
     * Build a document loader with URL mapping from config.
     */
    private async buildDocumentLoader(): Promise<DocumentLoader> {
        const urlMappingPath = this.config.urlMapping()
        let urlToLocalMap: Map<string, string> | undefined

        if (urlMappingPath) {
            try {
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
                if (workspaceRoot) {
                    const mappingUri = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), urlMappingPath)
                    const content = await vscode.workspace.fs.readFile(mappingUri)
                    const mapping = JSON.parse(Buffer.from(content).toString('utf-8'))
                    urlToLocalMap = new Map(Object.entries(mapping))
                }
            } catch (error) {
                this.logger.warn?.(`Could not load URL mapping from ${urlMappingPath}: ${error}`)
            }
        }

        return buildDocumentLoader({
            urlToLocalMap
        })
    }

    /**
     * Convert ValidationOutcome to VS Code Diagnostics.
     */
    private convertToDiagnostics(outcome: ValidationOutcome, doc: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = []
        const outputs = outcome.allValidationOutputs()

        for (const output of outputs) {
            const diagnostic = this.convertOutputToDiagnostic(output, doc)
            if (diagnostic) {
                diagnostics.push(diagnostic)
            }
        }

        return diagnostics
    }

    /**
     * Convert a single ValidationOutput to a VS Code Diagnostic.
     */
    private convertOutputToDiagnostic(output: ValidationOutput, doc: vscode.TextDocument): vscode.Diagnostic | undefined {
        // Determine range from line/character info or fall back to start of document
        let range: vscode.Range

        this.logger.debug?.(`[validation] Converting output: path=${output.path}, line_start=${output.line_start}, line_end=${output.line_end}, char_start=${output.character_start}, char_end=${output.character_end}`)

        if (output.line_start !== undefined && output.line_end !== undefined) {
            // ValidationOutput uses 1-based line numbers
            const startLine = Math.max(0, (output.line_start ?? 1) - 1)
            const endLine = Math.max(0, (output.line_end ?? 1) - 1)
            const startChar = output.character_start ?? 0
            const endChar = output.character_end ?? doc.lineAt(endLine).text.length

            range = new vscode.Range(startLine, startChar, endLine, endChar)
            this.logger.debug?.(`[validation] Using line info: range=${startLine}:${startChar}-${endLine}:${endChar}`)
        } else if (output.path) {
            // Try to find the path in the document
            range = this.findPathInDocument(output.path, doc)
            this.logger.debug?.(`[validation] Using path lookup for: ${output.path}`)
        } else {
            range = new vscode.Range(0, 0, 0, 0)
            this.logger.debug?.(`[validation] No location info, using start of document`)
        }

        // Map severity
        const severity = this.mapSeverity(output.severity)

        const diagnostic = new vscode.Diagnostic(
            range,
            output.message,
            severity
        )

        diagnostic.source = 'CALM'
        diagnostic.code = output.code

        return diagnostic
    }

    /**
     * Try to find a JSON path in the document and return its range.
     * Handles paths like /nodes/0/unique-id or /relationships/1
     */
    private findPathInDocument(jsonPath: string, doc: vscode.TextDocument): vscode.Range {
        const text = doc.getText()
        const segments = jsonPath.split('/').filter(s => s.length > 0)
        
        if (segments.length === 0) {
            return new vscode.Range(0, 0, 0, 0)
        }

        // Try to navigate through the JSON structure
        let searchPos = 0
        
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i]
            const isArrayIndex = /^\d+$/.test(segment)
            
            if (isArrayIndex) {
                // Find the nth element in an array - look for [ then count commas/objects
                const arrayIndex = parseInt(segment, 10)
                const arrayStart = text.indexOf('[', searchPos)
                if (arrayStart === -1) break
                
                // Find the start of the target array element
                let depth = 0
                let elementCount = 0
                let elementStart = arrayStart + 1
                
                for (let j = arrayStart + 1; j < text.length; j++) {
                    const char = text[j]
                    if (char === '{' || char === '[') {
                        if (depth === 0 && elementCount === arrayIndex) {
                            elementStart = j
                        }
                        depth++
                    } else if (char === '}' || char === ']') {
                        depth--
                        if (depth < 0) break // End of array
                    } else if (char === ',' && depth === 0) {
                        elementCount++
                        if (elementCount === arrayIndex) {
                            // Next element starts after this comma
                            elementStart = j + 1
                        }
                    }
                    
                    if (depth === 0 && elementCount === arrayIndex && (char === '{' || char === '[')) {
                        searchPos = j
                        break
                    }
                }
                
                // If this is the last segment, return range for the element
                if (i === segments.length - 1) {
                    const pos = doc.positionAt(elementStart)
                    // Find the end of this element
                    let endPos = elementStart
                    depth = 0
                    for (let j = elementStart; j < text.length; j++) {
                        const char = text[j]
                        if (char === '{' || char === '[') depth++
                        else if (char === '}' || char === ']') {
                            depth--
                            if (depth === 0) {
                                endPos = j + 1
                                break
                            }
                        }
                    }
                    const _endPosition = doc.positionAt(endPos)
                    return new vscode.Range(pos.line, 0, pos.line, doc.lineAt(pos.line).text.length)
                }
            } else {
                // Property name - search for "propertyName":
                const searchPattern = `"${segment}"`
                const index = text.indexOf(searchPattern, searchPos)
                
                if (index === -1) break
                
                // If this is the last segment, return the range
                if (i === segments.length - 1) {
                    const pos = doc.positionAt(index)
                    return new vscode.Range(pos.line, 0, pos.line, doc.lineAt(pos.line).text.length)
                }
                
                searchPos = index + searchPattern.length
            }
        }

        // Fallback: return first line
        return new vscode.Range(0, 0, 0, 0)
    }

    /**
     * Map ValidationOutput severity to VS Code DiagnosticSeverity.
     */
    private mapSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity.toLowerCase()) {
            case 'error':
                return vscode.DiagnosticSeverity.Error
            case 'warning':
                return vscode.DiagnosticSeverity.Warning
            case 'information':
            case 'info':
                return vscode.DiagnosticSeverity.Information
            case 'hint':
                return vscode.DiagnosticSeverity.Hint
            default:
                return vscode.DiagnosticSeverity.Error
        }
    }

    /**
     * Clear all diagnostics.
     */
    clearAll(): void {
        this.diagnosticCollection.clear()
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose())
    }
}
