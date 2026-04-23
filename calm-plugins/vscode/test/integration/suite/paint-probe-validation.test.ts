// Self-validation for the rAF-based paint probe (issue #2361).
//
// This suite doesn't touch the CALM extension. It creates a *standalone* webview
// inside the test that deliberately reproduces the original buggy pattern:
// `createWebviewPanel` immediately followed by `panel.reveal()`. It uses the
// same rAF-based probe (webview posts `rendered` after 2 rAF ticks) as the
// production code.
//
// This proves two things *on the remote CI runner*:
//   1. On VSCode 1.116+, the buggy pattern produces no `rendered` message
//      within the timeout — i.e. the probe actually catches the regression.
//   2. On VSCode 1.115, the same pattern DOES produce `rendered` — i.e. the
//      probe isn't stuck returning false for unrelated reasons (broken rAF
//      under Xvfb, etc).
//
// If either expectation fails on CI we know the probe isn't trustworthy, even
// though the main integration test (which runs the fixed extension) would still
// pass. This is the remote-validation the main test alone cannot give us.

import * as assert from 'assert'
import * as vscode from 'vscode'

const VIEW_TYPE = 'calmPaintProbe'

function makeBuggyWebviewHtml(): string {
    // Mirrors what panel.view-model.ts does in the real webview: after 2 rAF
    // ticks, post {type: 'rendered'}. Also post {type: 'ready'} immediately so
    // we can distinguish "JS never ran" from "paint stalled".
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<h1>paint probe</h1>
<script>
  const vscode = acquireVsCodeApi();
  vscode.postMessage({ type: 'ready' });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    vscode.postMessage({ type: 'rendered' });
  }));
</script>
</body>
</html>`
}

interface ProbeResult {
    ready: boolean
    rendered: boolean
}

async function runBuggyProbe(timeoutMs: number): Promise<ProbeResult> {
    // Reproduce the buggy pattern from the pre-fix CALM extension:
    // create the panel AND THEN call reveal() on it. createWebviewPanel already
    // shows the panel, so the second call is what triggers the paint stall on
    // VSCode 1.116.
    const panel = vscode.window.createWebviewPanel(
        VIEW_TYPE,
        'Paint Probe',
        vscode.ViewColumn.Beside,
        { enableScripts: true, retainContextWhenHidden: true }
    )
    panel.webview.html = makeBuggyWebviewHtml()
    panel.reveal(vscode.ViewColumn.Beside) // <-- the bug pattern

    let ready = false
    let rendered = false
    const gotRendered = new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, timeoutMs)
        panel.webview.onDidReceiveMessage((msg: { type?: string }) => {
            if (msg?.type === 'ready') ready = true
            if (msg?.type === 'rendered') {
                rendered = true
                clearTimeout(timer)
                resolve()
            }
        })
    })
    await gotRendered
    panel.dispose()
    return { ready, rendered }
}

const vscodeVersion = process.env.VSCODE_VERSION ?? 'stable'

suite('Paint probe self-validation (standalone webview)', () => {
    if (vscodeVersion.startsWith('1.116')) {
        test(`probe catches paint stall on ${vscodeVersion} (expects rendered=false)`, async function () {
            this.timeout(30_000)
            const { ready, rendered } = await runBuggyProbe(15_000)
            assert.strictEqual(ready, true, 'JS should still execute — `ready` expected')
            assert.strictEqual(
                rendered,
                false,
                'rAF should NOT fire on 1.116 with the bug pattern. If this asserts true, ' +
                'the probe is not detecting the paint stall and would silently pass in CI.'
            )
        })
    } else {
        test(`probe does not false-positive on ${vscodeVersion} (expects rendered=true)`, async function () {
            this.timeout(30_000)
            const { ready, rendered } = await runBuggyProbe(15_000)
            assert.strictEqual(ready, true)
            assert.strictEqual(
                rendered,
                true,
                `rAF should fire on ${vscodeVersion} (paint regression is 1.116-specific). ` +
                'If this asserts false, the probe is returning false for unrelated reasons ' +
                '(e.g. broken rAF under Xvfb) and would false-positive in CI.'
            )
        })
    }
})
