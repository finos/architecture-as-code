// Orchestrator: iterate the implemented shots in shots.ts, launching VSCode
// once per shot for deterministic state. Writes PNGs into the docs static
// folder and a manifest alongside.

import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchVSCodeWithExtension, PINNED_VSCODE_VERSION } from './launch.js'
import { normaliseWorkbench } from './normalise.js'
import { writePng, type ManifestEntry } from './shoot.js'
import { shots, implementedShots } from './shots.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = path.resolve(__dirname, '..')
const EXTENSION_DIR = path.resolve(SCREENSHOTS_DIR, '..')
const REPO_ROOT = path.resolve(EXTENSION_DIR, '../..')
const FIXTURES_DIR = path.join(SCREENSHOTS_DIR, 'fixtures')
const OUTPUT_DIR = path.join(REPO_ROOT, 'docs/static/img/vscode')
const MANIFEST_PATH = path.join(OUTPUT_DIR, '_manifest.json')

interface Manifest {
    generatedAt: string
    vscodeVersion: string
    shots: ManifestEntry[]
    skipped: { name: string; reason: string }[]
}

async function main() {
    mkdirSync(OUTPUT_DIR, { recursive: true })

    console.log(`[shoot] ${implementedShots.length} implemented shots, ${shots.length - implementedShots.length} skipped (TODO)`)
    console.log(`[shoot] output → ${OUTPUT_DIR}`)

    const entries: ManifestEntry[] = []

    // Optional filter via SHOOT_ONLY=03-tree-search,04-preview-hero to
    // iterate one or a few shots without running the whole set. Useful while
    // developing. Names not in `implementedShots` (i.e. `implemented: false`)
    // are still ignored — the filter narrows the implemented set, it doesn't
    // bypass the implementation flag.
    const onlyEnv = process.env.SHOOT_ONLY?.trim()
    const allowed = onlyEnv ? new Set(onlyEnv.split(',').map((s) => s.trim())) : null
    const todoShots = shots.filter((s) => !s.implemented && (!allowed || allowed.has(s.name)))

    for (const shot of implementedShots) {
        if (allowed && !allowed.has(shot.name)) continue

        const workspaceFile = shot.workspaceFile ?? 'architecture.json'
        const fixturePath = path.join(FIXTURES_DIR, shot.fixture, workspaceFile)
        console.log(`\n[shoot] ${shot.name}  fixture=${shot.fixture}/${workspaceFile}`)

        const { window, cleanup } = await launchVSCodeWithExtension({
            extensionPath: EXTENSION_DIR,
            workspacePath: fixturePath,
            settingsOverrides: shot.settings,
        })

        try {
            await normaliseWorkbench(window)
            // Extension activates on `onStartupFinished`; give it a moment.
            await window.waitForTimeout(1_500)

            await shot.setup(window)
            await window.waitForTimeout(500)

            const png = await shot.capture(window)
            const outFile = path.join(OUTPUT_DIR, `${shot.name}.png`)
            const entry = writePng(outFile, png)
            entries.push(entry)
            console.log(`[shoot]   wrote ${entry.name} (${entry.width}x${entry.height}, ${entry.bytes} bytes)`)
        } finally {
            await cleanup()
        }
    }

    const skipped = todoShots.map((s) => ({
        name: s.name,
        reason: 'TODO — see issue #2529',
    }))

    if (allowed) {
        console.log(
            `\n[shoot] SHOOT_ONLY active — manifest NOT updated. Run a full shoot to regenerate the manifest.`
        )
        console.log(`[shoot] ${entries.length} shot(s) written.`)
        return
    }

    const manifest: Manifest = {
        generatedAt: new Date().toISOString(),
        vscodeVersion: PINNED_VSCODE_VERSION,
        shots: entries,
        skipped,
    }
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n')
    console.log(`\n[shoot] manifest → ${MANIFEST_PATH}`)
    console.log(`[shoot] ${entries.length} shot(s) written, ${skipped.length} skipped.`)
}

main().catch((err) => {
    console.error('[shoot] FAILED:', err)
    process.exit(1)
})
