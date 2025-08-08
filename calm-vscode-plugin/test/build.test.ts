import { describe, it, expect } from 'vitest'

describe('smoke', () => {
    it('build artifacts exist', async () => {
        const fs = await import('fs')
        const path = (p: string) => __dirname + '/../' + p
        if (!fs.existsSync(path('dist/extension.js')) || !fs.existsSync(path('dist/webview/main.global.js'))){
            const cp = await import('child_process')
            await new Promise<void>((resolve, reject) => {
                const p = cp.exec('npm run -s build', { cwd: __dirname + '/..' }, (err) => err ? reject(err) : resolve())
                p?.stdout?.on('data', () => {})
                p?.stderr?.on('data', () => {})
            })
        }
        expect(fs.existsSync(path('dist/extension.js'))).toBe(true)
        expect(fs.existsSync(path('dist/webview/main.global.js'))).toBe(true)
    })
})
