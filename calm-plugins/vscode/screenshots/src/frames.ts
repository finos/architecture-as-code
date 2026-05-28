// VSCode wraps extension webviews in two nested iframes: an outer index.html
// wrapper (sandbox boundary) and an inner fake.html where the extension's
// actual content lives. Most automation needs to reach the inner frame to
// click or hover on elements inside the preview canvas.

import type { Frame, Page } from 'playwright'

// Identifier for the outer webview wrapper frame.
const OUTER_WEBVIEW_PATTERN = /vscode-webview:\/\/.+\/index\.html/

// Identifier for the inner content frame, where the extension renders its HTML.
const INNER_WEBVIEW_PATTERN = /vscode-webview:\/\/.+\/fake\.html/

// Returns the outer wrapper frame of the (first) extension webview, or
// undefined if none has loaded yet. For the single-panel case (only the CALM
// preview is open), this is sufficient. If multiple webviews are open at
// once a future caller will need to disambiguate by inspecting frame state.
export function findOuterWebviewFrame(window: Page): Frame | undefined {
    return window.frames().find((f) => OUTER_WEBVIEW_PATTERN.test(f.url()))
}

export function findInnerWebviewFrame(window: Page): Frame | undefined {
    return window.frames().find((f) => INNER_WEBVIEW_PATTERN.test(f.url()))
}

// Convenience: wait until both wrapper + content frames have loaded.
export async function waitForWebviewReady(
    window: Page,
    timeoutMs = 10_000
): Promise<{ outer: Frame; inner: Frame }> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const outer = findOuterWebviewFrame(window)
        const inner = findInnerWebviewFrame(window)
        if (outer && inner) {
            return { outer, inner }
        }
        await window.waitForTimeout(200)
    }
    throw new Error(`Webview frames did not appear within ${timeoutMs}ms`)
}
