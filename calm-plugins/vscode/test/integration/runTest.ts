import * as path from 'path'
import { runTests } from '@vscode/test-electron'

async function main() {
    // Extension root (where package.json lives): calm-plugins/vscode/
    // From out/integration/runTest.js, walk up three levels.
    const extensionDevelopmentPath = path.resolve(__dirname, '../../..')
    const extensionTestsPath = path.resolve(__dirname, './suite/index')

    // VSCODE_VERSION: e.g. '1.115.0', '1.116.0', 'stable', 'insiders'.
    // Defaults to 'stable' when unset. Used by the CI matrix to pin versions.
    const version = process.env.VSCODE_VERSION || 'stable'
    console.log(`[integration] Running against VSCode version: ${version}`)

    // Retry once on transient failures (e.g. CDN timeout resolving 'stable').
    const attempts = 2
    for (let i = 1; i <= attempts; i++) {
        try {
            await runTests({
                version,
                extensionDevelopmentPath,
                extensionTestsPath,
                // --disable-extensions ensures only our extension is loaded (faster, deterministic).
                launchArgs: ['--disable-extensions'],
            })
            return
        } catch (err) {
            if (i === attempts) {
                console.error('Failed to run integration tests', err)
                process.exit(1)
            }
            console.warn(`[integration] Attempt ${i}/${attempts} failed, retrying:`, err)
        }
    }
}

main()
