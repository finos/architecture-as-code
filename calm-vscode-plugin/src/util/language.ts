import * as vscode from 'vscode'

export function provideHovers(getIndex: () => { rangeOf(id: string): vscode.Range | undefined } | undefined): vscode.HoverProvider {
    return {
        provideHover(doc: vscode.TextDocument, pos: vscode.Position) {
            const idx = getIndex()
            if (!idx) return undefined
            // naive: Not parsing by AST. Just show id under cursor if available
            const word = doc.getText(doc.getWordRangeAtPosition(pos, /[A-Za-z0-9_-]+/))
            if (!word) return undefined
            const r = idx.rangeOf(word)
            if (!r) return undefined
            return new vscode.Hover(`CALM id: ${word}`)
        }
    }
}

export function provideCodeLens(getIndex: () => { rangeOf(id: string): vscode.Range | undefined } | undefined): vscode.CodeLensProvider {
    return {
        provideCodeLenses(doc: vscode.TextDocument) {
            const text = doc.getText()
            const lenses: vscode.CodeLens[] = []
            const rx = /"(?:id|unique-id)"\s*:\s*"([^"]+)"/g
            let m: RegExpExecArray | null
            while ((m = rx.exec(text))) {
                const id = m[1]
                const range = new vscode.Range(doc.positionAt(m.index), doc.positionAt(m.index + m[0].length))
                lenses.push(new vscode.CodeLens(range, { command: 'calm.openPreview', title: 'Reveal in Graph' }))
            }
            return lenses
        }
    }
}
