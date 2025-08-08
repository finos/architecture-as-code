import { describe, it, expect } from 'vitest'

describe('smoke', () => {
    it('build artifacts exist', async () => {
        const fs = await import('fs')
        expect(fs.existsSync(__dirname + '/../dist/extension.js')).toBe(true)
        expect(fs.existsSync(__dirname + '/../dist/webview/main.js')).toBe(true)
    })
})
