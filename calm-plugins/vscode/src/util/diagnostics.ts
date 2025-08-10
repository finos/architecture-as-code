import * as vscode from 'vscode'

export class DiagnosticsManager {
    private collection: vscode.DiagnosticCollection
    constructor(name: string) {
        this.collection = vscode.languages.createDiagnosticCollection(name)
    }
    clear(uri: vscode.Uri) {
        this.collection.delete(uri)
    }
    apply(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]) {
        this.collection.set(uri, diagnostics)
    }
    static basicValidate(model: any): vscode.Diagnostic[] {
        const diags: vscode.Diagnostic[] = []
        const add = (msg: string) => diags.push(new vscode.Diagnostic(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1)), msg, vscode.DiagnosticSeverity.Warning))
        if (!model || typeof model !== 'object') { add('Model is not an object'); return diags }
        if (!Array.isArray(model.nodes)) add('Missing or invalid nodes[]')
        if (!Array.isArray(model.relationships)) add('Missing or invalid relationships[]')
        if (!Array.isArray(model.flows)) add('Missing or invalid flows[]')
        // naive reference check
        const ids = new Set((model.nodes || []).map((n: any) => n.id))
        for (const r of (model.relationships || [])) {
            if (!ids.has(r.source) || !ids.has(r.target)) add(`Unknown reference in relationship ${r.id || ''}`)
        }
        for (const f of (model.flows || [])) {
            if (!ids.has(f.source) || !ids.has(f.target)) add(`Unknown reference in flow ${f.id || ''}`)
        }
        return diags
    }
}
