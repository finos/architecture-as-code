import * as vscode from 'vscode'
import * as path from 'path'
import * as cp from 'child_process'

export async function runCliValidate(cliPath: string, uri: vscode.Uri, cwd: string | undefined, output: vscode.OutputChannel) {
    const cmd = resolveCli(cliPath)
    return new Promise<{ ok: boolean; diagnostics: vscode.Diagnostic[] }>((resolve, reject) => {
        const child = cp.spawn(cmd, ['validate', uri.fsPath, '--format', 'junit'], { cwd, shell: true })
        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (d: Buffer) => stdout += d.toString())
        child.stderr.on('data', (d: Buffer) => stderr += d.toString())
        child.on('error', (err: Error) => reject(err))
        child.on('close', (code: number) => {
            output.appendLine(`[CLI validate] exit ${code}\n${stderr}`)
            // TODO: parse junit; first iteration: treat nonzero as warning
            const ok = code === 0
            resolve({ ok, diagnostics: [] })
        })
    })
}

export async function runCliDocify(cliPath: string, uri: vscode.Uri, cwd: string | undefined, output: vscode.OutputChannel) {
    const cmd = resolveCli(cliPath)
    return new Promise<{ ok: boolean; outputDir?: string }>((resolve, reject) => {
        const child = cp.spawn(cmd, ['docify', path.dirname(uri.fsPath)], { cwd, shell: true })
        let stderr = ''
        child.stderr.on('data', (d: Buffer) => stderr += d.toString())
        child.on('error', (err: Error) => reject(err))
        child.on('close', (code: number) => {
            output.appendLine(`[CLI docify] exit ${code}\n${stderr}`)
            resolve({ ok: code === 0, outputDir: path.join(path.dirname(uri.fsPath), 'docs') })
        })
    })
}

function resolveCli(cliPath: string) {
    // Prefer local cli folder's bin if exists
    if (cliPath.startsWith('.')) return `node ${path.join(cliPath, 'dist/index.js')}`
    return cliPath
}
