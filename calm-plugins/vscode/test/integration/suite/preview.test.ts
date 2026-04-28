import * as assert from 'assert'
import * as path from 'path'
import * as vscode from 'vscode'

// Mirrors the CalmExtensionTestApi shape returned from activate(). Kept local
// to avoid coupling the test compile to the extension's source graph.
interface CalmTestApi {
    waitForPreviewReady(timeoutMs?: number): Promise<boolean>
    waitForPreviewRendered(timeoutMs?: number): Promise<boolean>
}

const EXTENSION_ID = 'FINOS.calm-vscode-plugin'
const PREVIEW_VIEW_TYPE = 'calmPreview'
const FIXTURE_REL = '../../../test_fixtures/architecture/test.architecture.1.2.json'

function findCalmPreviewTab(): vscode.Tab | undefined {
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            if (tab.input instanceof vscode.TabInputWebview && tab.input.viewType.endsWith(PREVIEW_VIEW_TYPE)) {
                return tab
            }
        }
    }
    return undefined
}

async function waitForCalmPreviewTab(timeoutMs: number): Promise<vscode.Tab | undefined> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const tab = findCalmPreviewTab()
        if (tab) return tab
        await new Promise((r) => setTimeout(r, 100))
    }
    return undefined
}

suite('CALM Preview — open and render (issue #2361 regression guard)', () => {
    let testApi: CalmTestApi

    suiteSetup(async function () {
        this.timeout(30_000)
        const ext = vscode.extensions.getExtension(EXTENSION_ID)
        assert.ok(ext, `Extension ${EXTENSION_ID} not found`)
        const api = await ext!.activate()
        assert.ok(api, 'Extension activate() did not return a test API')
        testApi = api as CalmTestApi
        assert.strictEqual(
            typeof testApi.waitForPreviewReady,
            'function',
            'Test API missing waitForPreviewReady'
        )
    })

    test('open preview command creates a webview tab that reports ready and rendered', async function () {
        this.timeout(30_000)

        const fixturePath = path.resolve(__dirname, FIXTURE_REL)
        const doc = await vscode.workspace.openTextDocument(fixturePath)
        await vscode.window.showTextDocument(doc)

        await vscode.commands.executeCommand('calm.openPreview')

        const tab = await waitForCalmPreviewTab(5_000)
        assert.ok(tab, 'Expected a tab with viewType=calmPreview after calm.openPreview')

        const ready = await testApi.waitForPreviewReady(15_000)
        assert.strictEqual(
            ready,
            true,
            'Preview webview never posted `ready` within 15s — JS did not execute'
        )

        const rendered = await testApi.waitForPreviewRendered(15_000)
        assert.strictEqual(
            rendered,
            true,
            'Preview webview never posted `rendered` within 15s — compositor appears stalled (issue #2361 regression)'
        )
    })
})
