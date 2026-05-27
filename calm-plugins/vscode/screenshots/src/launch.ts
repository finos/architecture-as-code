// Resolve a pinned VSCode binary and launch it via Playwright Electron with
// our extension loaded under --extensionDevelopmentPath. Returns the ElectronApplication
// + the first window so the orchestrator can drive the UI.

import { downloadAndUnzipVSCode } from '@vscode/test-electron'
import { _electron as electron, type ElectronApplication, type Page } from 'playwright'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// User settings written into each fresh user-data-dir before launch. Anything
// that the workbench reads at startup belongs here, not in a runCommand call.
// Hiding the secondary side bar at launch is the only reliable way — closing
// it via the `closeAuxiliaryBar` command leaves the panel visible if VSCode
// or a built-in feature re-opens it during activation.
const WORKBENCH_SETTINGS = {
    'workbench.startupEditor': 'none',
    'workbench.secondarySideBar.defaultVisibility': 'hidden',
    'workbench.layoutControl.enabled': false,
    'chat.commandCenter.enabled': false,
    'update.mode': 'none',
    'update.showReleaseNotes': false,
    'telemetry.telemetryLevel': 'off',
    'workbench.tips.enabled': false,
    'workbench.welcomePage.walkthroughs.openOnInstall': false,
    'extensions.ignoreRecommendations': true,
}

// Bumping this is intentional and requires regenerating every PNG in the same PR.
// See AGENTS.md → "Pin a different VSCode version".
export const PINNED_VSCODE_VERSION = '1.121.0'

export interface LaunchOptions {
    extensionPath: string
    workspacePath: string
}

export interface LaunchResult {
    app: ElectronApplication
    window: Page
    cleanup: () => Promise<void>
}

export async function launchVSCodeWithExtension(opts: LaunchOptions): Promise<LaunchResult> {
    if (!existsSync(path.join(opts.extensionPath, 'dist/extension.js'))) {
        throw new Error(
            `Extension not built at ${opts.extensionPath}/dist/extension.js. ` +
                `From the repo root: npm run build --workspace calm-plugins/vscode`
        )
    }

    const executablePath = await downloadAndUnzipVSCode(PINNED_VSCODE_VERSION)

    const userDataDir = mkdtempSync(path.join(tmpdir(), 'calm-vscode-shots-user-'))
    const extensionsDir = mkdtempSync(path.join(tmpdir(), 'calm-vscode-shots-ext-'))

    // Seed workbench settings into the user-data-dir so the layout is correct
    // from the first paint — no flash of the secondary side bar.
    const userDir = path.join(userDataDir, 'User')
    mkdirSync(userDir, { recursive: true })
    writeFileSync(
        path.join(userDir, 'settings.json'),
        JSON.stringify(WORKBENCH_SETTINGS, null, 2) + '\n'
    )

    const args = [
        `--extensionDevelopmentPath=${opts.extensionPath}`,
        `--user-data-dir=${userDataDir}`,
        `--extensions-dir=${extensionsDir}`,
        '--disable-workspace-trust',
        '--disable-updates',
        '--disable-telemetry',
        '--skip-welcome',
        '--skip-release-notes',
        '--no-sandbox',
        opts.workspacePath,
    ]

    const app = await electron.launch({
        executablePath,
        args,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '' },
    })

    const window = await app.firstWindow()
    await window.waitForSelector('.monaco-workbench', { timeout: 30_000 })

    const cleanup = async () => {
        try {
            await app.close()
        } catch {
            // best effort
        }
    }

    return { app, window, cleanup }
}
