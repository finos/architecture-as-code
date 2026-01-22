import * as vscode from 'vscode'
import {
    validate,
    ValidationOutcome,
    ValidationOutput,
    SchemaDirectory,
    loadArchitectureAndPattern
} from '@finos/calm-shared'
import { buildDocumentLoader, DocumentLoader } from '@finos/calm-shared/dist/document-loader/document-loader'
import type { Logger } from '../../core/ports/logger'
import type { Config } from '../../core/ports/config'

/**
 * Service that validates CALM documents and reports diagnostics to VS Code.
 * Follows the hexagonal architecture pattern - depends on ports, not VSCode directly
 * (except for the DiagnosticCollection which is the output port).
 */
export class ValidationService implements vscode.Disposable {
    private readonly diagnosticCollection: vscode.DiagnosticCollection
    private readonly disposables: vscode.Disposable[] = []

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
        // Validate on save
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(doc => {
                if (this.isCalmDocument(doc)) {
                    void this.validateDocument(doc)
                }
            })
        )

        // Clear diagnostics when document is closed
        this.disposables.push(
            vscode.workspace.onDidCloseTextDocument(doc => {
                this.diagnosticCollection.delete(doc.uri)
            })
        )

        // Validate currently open CALM documents on activation
        vscode.workspace.textDocuments.forEach(doc => {
            if (this.isCalmDocument(doc)) {
                void this.validateDocument(doc)
            }
        })

        context.subscriptions.push(...this.disposables)
    }

    /**
     * Check if a document is a CALM JSON file based on configured globs.
     */
    private isCalmDocument(doc: vscode.TextDocument): boolean {
        if (doc.languageId !== 'json') {
            return false
        }
        const relativePath = vscode.workspace.asRelativePath(doc.uri)
        const globs = this.config.filesGlobs()
        return globs.some(glob => this.matchGlob(relativePath, glob))
    }

    /**
     * Simple glob matching for common patterns.
     */
    private matchGlob(path: string, glob: string): boolean {
        // Convert glob to regex (simplified)
        const regexStr = glob
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.')
        const regex = new RegExp(`^${regexStr}$`)
        return regex.test(path)
    }

    /**
     * Validate a CALM document and update diagnostics.
     */
    async validateDocument(doc: vscode.TextDocument): Promise<void> {
        this.logger.info?.(`Validating CALM document: ${doc.uri.fsPath}`)

        try {
            const text = doc.getText()
            let architecture: object

            try {
                architecture = JSON.parse(text)
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

        if (output.line_start !== undefined && output.line_end !== undefined) {
            // ValidationOutput uses 1-based line numbers
            const startLine = Math.max(0, (output.line_start ?? 1) - 1)
            const endLine = Math.max(0, (output.line_end ?? 1) - 1)
            const startChar = output.character_start ?? 0
            const endChar = output.character_end ?? doc.lineAt(endLine).text.length

            range = new vscode.Range(startLine, startChar, endLine, endChar)
        } else if (output.path) {
            // Try to find the path in the document
            range = this.findPathInDocument(output.path, doc)
        } else {
            range = new vscode.Range(0, 0, 0, 0)
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
     */
    private findPathInDocument(jsonPath: string, doc: vscode.TextDocument): vscode.Range {
        // Simple approach: search for the last segment of the path as a key
        const segments = jsonPath.split('/')
        const lastSegment = segments[segments.length - 1]

        if (lastSegment && !/^\d+$/.test(lastSegment)) {
            // It's a property name, not an array index
            const searchPattern = `"${lastSegment}"`
            const text = doc.getText()
            const index = text.indexOf(searchPattern)

            if (index !== -1) {
                const pos = doc.positionAt(index)
                return new vscode.Range(pos, pos.translate(0, searchPattern.length))
            }
        }

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
