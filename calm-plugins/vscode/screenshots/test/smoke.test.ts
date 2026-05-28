// Smoke test: assert every IMPLEMENTED shot produced a non-empty PNG matching
// the manifest. Does NOT regenerate shots — runs against whatever is committed
// in docs/static/img/vscode/.
//
// This is local-only by design; see issue #2529 for the rationale on not
// running it in CI.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { implementedShots, shots } from '../src/shots.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../..')
const OUTPUT_DIR = path.join(REPO_ROOT, 'docs/static/img/vscode')
const MANIFEST_PATH = path.join(OUTPUT_DIR, '_manifest.json')

interface ManifestShot {
    name: string
    width: number
    height: number
    bytes: number
    sha256: string
}

interface Manifest {
    generatedAt: string
    vscodeVersion: string
    shots: ManifestShot[]
    skipped: { name: string; reason: string }[]
}

describe('screenshot manifest', () => {
    it('manifest file exists', () => {
        expect(existsSync(MANIFEST_PATH)).toBe(true)
    })

    it('manifest lists every implemented shot exactly once', () => {
        const manifest: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
        const manifestNames = manifest.shots.map((s) => s.name).sort()
        const expectedNames = implementedShots.map((s) => `${s.name}.png`).sort()
        expect(manifestNames).toEqual(expectedNames)
    })

    it('manifest lists every TODO shot under skipped', () => {
        const manifest: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
        const skippedNames = manifest.skipped.map((s) => s.name).sort()
        const expectedSkipped = shots
            .filter((s) => !s.implemented)
            .map((s) => s.name)
            .sort()
        expect(skippedNames).toEqual(expectedSkipped)
    })
})

describe.each(implementedShots)('shot $name', (shot) => {
    const pngPath = path.join(OUTPUT_DIR, `${shot.name}.png`)

    it('PNG exists', () => {
        expect(existsSync(pngPath)).toBe(true)
    })

    it('PNG is non-empty', () => {
        const bytes = readFileSync(pngPath)
        expect(bytes.length).toBeGreaterThan(1_000)
    })

    it('PNG signature is valid', () => {
        const bytes = readFileSync(pngPath)
        // PNG starts with 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
        expect(bytes[0]).toBe(0x89)
        expect(bytes.toString('ascii', 1, 4)).toBe('PNG')
    })

    it('PNG dimensions match the manifest entry', () => {
        const bytes = readFileSync(pngPath)
        const width = bytes.readUInt32BE(16)
        const height = bytes.readUInt32BE(20)
        const manifest: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
        const entry = manifest.shots.find((s) => s.name === `${shot.name}.png`)
        expect(entry).toBeDefined()
        expect(entry!.width).toBe(width)
        expect(entry!.height).toBe(height)
    })

    it('PNG sha256 matches the manifest entry', () => {
        const bytes = readFileSync(pngPath)
        const sha = createHash('sha256').update(bytes).digest('hex')
        const manifest: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
        const entry = manifest.shots.find((s) => s.name === `${shot.name}.png`)
        expect(entry!.sha256).toBe(sha)
    })
})
