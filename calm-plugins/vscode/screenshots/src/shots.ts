// Declarative shot list. Each entry produces one PNG under docs/static/img/vscode/.
//
// Adding a shot: see AGENTS.md → "Common workflows → Add a shot".

import type { Page } from 'playwright'
import { runCommand, runCommandByTitle } from './normalise.js'
import { captureFullWindow } from './shoot.js'
import { findInnerWebviewFrame } from './frames.js'

export interface Shot {
    name: string
    // Fixture folder name under fixtures/. The orchestrator opens
    // fixtures/<name>/<workspaceFile> by default; override `workspaceFile`
    // if the shot needs an entry file other than architecture.json.
    fixture: string
    workspaceFile?: string
    description: string
    implemented: boolean
    // Optional workbench-settings overrides merged into the seeded settings.json
    // for this shot's VSCode launch. Use for theme, layout engine, or any other
    // setting that needs to be in place before the first paint.
    settings?: Record<string, unknown>
    setup: (window: Page) => Promise<void>
    capture: (window: Page) => Promise<Buffer>
}

// Wait for a Mermaid-rendered diagram inside the preview's inner webview frame
// to settle. The preview emits no event we can hook, so we poll for the
// presence of node-shaped elements and then settle.
async function waitForDiagramRendered(window: Page, timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const inner = findInnerWebviewFrame(window)
        if (inner) {
            try {
                const count = await inner.locator('svg .node, svg g.node').count()
                if (count > 0) {
                    await window.waitForTimeout(800)
                    return
                }
            } catch {
                // frame detached mid-poll; retry
            }
        }
        await window.waitForTimeout(200)
    }
    // Don't throw — let the shot capture whatever rendered. Logs the partial.
    console.warn(`[shoot]   waitForDiagramRendered timed out after ${timeoutMs}ms`)
}

async function openPreview(window: Page): Promise<void> {
    await runCommandByTitle(window, 'CALM: Open Preview')
    await window.waitForFunction(
        () => {
            const tabs = Array.from(document.querySelectorAll('.tab .tab-label'))
            return tabs.some((t) => /preview/i.test(t.textContent || ''))
        },
        { timeout: 20_000 }
    )
    await waitForDiagramRendered(window)
}

export const shots: Shot[] = [
    {
        name: '01-activity-bar',
        fixture: 'three-tier',
        description: 'CALM icon and Model Elements view in the activity bar.',
        implemented: true,
        async setup(window) {
            await runCommand(window, 'workbench.view.extension.calm')
            await window.waitForTimeout(800)
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    {
        name: '02-tree-view',
        fixture: 'three-tier',
        description: 'Model Elements tree with Nodes, Relationships, Flows expanded.',
        implemented: true,
        async setup(window) {
            await runCommand(window, 'workbench.view.extension.calm')
            await window.waitForTimeout(1_200)

            const first = window.locator('[role="treeitem"]').first()
            await first.click()
            await window.waitForTimeout(200)

            await window.keyboard.press('ArrowRight')
            await window.waitForTimeout(300)

            // Walk down the tree with ArrowDown + ArrowRight to expand each
            // visible top-level group (Nodes, Relationships, Flows). Six
            // iterations covers the group rows plus a couple of buffer steps
            // for any future top-level entries; on a closed leaf ArrowRight
            // is a no-op, on an already-expanded node it just moves focus.
            for (let i = 0; i < 6; i++) {
                await window.keyboard.press('ArrowDown')
                await window.keyboard.press('ArrowRight')
                await window.waitForTimeout(120)
            }
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    {
        name: '03-tree-search',
        fixture: 'three-tier',
        description: 'Search & filter in the Model Elements tree.',
        implemented: true,
        async setup(window) {
            await runCommand(window, 'workbench.view.extension.calm')
            await window.waitForTimeout(1_000)
            // The search command opens a quick-input prompt; type a substring
            // of a node ID and confirm so the tree shows the filtered result.
            await runCommandByTitle(window, 'Search Model Elements')
            await window.waitForSelector('.quick-input-widget', { timeout: 5_000 })
            await window.keyboard.type('api')
            await window.waitForTimeout(400)
            await window.keyboard.press('Enter')
            await window.waitForTimeout(800)
            // Expand the root so the matched item is visible.
            const first = window.locator('[role="treeitem"]').first()
            await first.click()
            await window.keyboard.press('ArrowRight')
            await window.waitForTimeout(300)
            for (let i = 0; i < 6; i++) {
                await window.keyboard.press('ArrowDown')
                await window.keyboard.press('ArrowRight')
                await window.waitForTimeout(100)
            }
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    {
        name: '04-preview-hero',
        fixture: 'three-tier',
        description: 'Live preview of the architecture next to its JSON source.',
        implemented: true,
        async setup(window) {
            await openPreview(window)
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    // Four theme variants. Each is a separate launch with `calm.docify.theme`
    // and `workbench.colorTheme` overridden in the seeded settings. The docs
    // page uses these as a 2x2 markdown gallery rather than a composite PNG,
    // because each variant can be linked / inspected on its own.
    {
        name: '05-theme-light',
        fixture: 'three-tier',
        description: 'Preview rendered with the light theme.',
        implemented: true,
        settings: { 'calm.docify.theme': 'light', 'workbench.colorTheme': 'Default Light Modern' },
        async setup(window) {
            await openPreview(window)
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },
    {
        name: '05-theme-dark',
        fixture: 'three-tier',
        description: 'Preview rendered with the dark theme.',
        implemented: true,
        settings: { 'calm.docify.theme': 'dark', 'workbench.colorTheme': 'Default Dark Modern' },
        async setup(window) {
            await openPreview(window)
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },
    {
        name: '05-theme-hc-light',
        fixture: 'three-tier',
        description: 'Preview rendered with the high-contrast light theme.',
        implemented: true,
        settings: {
            'calm.docify.theme': 'high-contrast-light',
            'workbench.colorTheme': 'Default High Contrast Light',
        },
        async setup(window) {
            await openPreview(window)
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },
    {
        name: '05-theme-hc-dark',
        fixture: 'three-tier',
        description: 'Preview rendered with the high-contrast dark theme.',
        implemented: true,
        settings: {
            'calm.docify.theme': 'high-contrast-dark',
            'workbench.colorTheme': 'Default High Contrast',
        },
        async setup(window) {
            await openPreview(window)
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    // Layout engines: ELK (default) and Dagre. Same fixture, different
    // `calm.preview.layout`. The docs page shows the two side by side.
    {
        name: '06-layout-elk',
        fixture: 'three-tier',
        description: 'Preview rendered with the ELK layout engine (default).',
        implemented: true,
        settings: { 'calm.preview.layout': 'elk' },
        async setup(window) {
            await openPreview(window)
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },
    {
        name: '06-layout-dagre',
        fixture: 'three-tier',
        description: 'Preview rendered with the Dagre layout engine.',
        implemented: true,
        settings: { 'calm.preview.layout': 'dagre' },
        async setup(window) {
            await openPreview(window)
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    {
        name: '07-validation-problems',
        fixture: 'broken',
        description: 'Real-time validation surfaces errors in the Problems panel.',
        implemented: true,
        async setup(window) {
            await runCommand(window, 'workbench.actions.view.problems')
            await window.waitForTimeout(2_500)
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    // Hover info on a node reference inside the JSON editor. The extension
    // contributes a hover provider, but reliably triggering its tooltip from
    // Playwright requires either a known editor pixel coordinate (mouse
    // hover) or a working Cmd+K Cmd+I chord. Cursor positioning works but
    // the chord doesn't fire the tooltip via Playwright's keyboard.press
    // sequence in this VSCode build. Left as a TODO follow-up — the docs
    // section can describe hover without a screenshot.
    {
        name: '08-hover',
        fixture: 'three-tier',
        description: 'Hover info on a node reference in the JSON editor.',
        implemented: false,
        async setup(window) {
            const editor = window.locator('.monaco-editor').first()
            await editor.click()
            await window.waitForTimeout(300)
            // Pin the cursor at line 1 deterministically. ArrowUp past the
            // top is a no-op, so 100 presses guarantees we land at line 1
            // regardless of where the click() positioned us.
            for (let i = 0; i < 100; i++) {
                await window.keyboard.press('ArrowUp')
            }
            // Line 14 of the fixture is `"unique-id": "web-frontend",`.
            for (let i = 0; i < 13; i++) {
                await window.keyboard.press('ArrowDown')
            }
            await window.keyboard.press('End')
            // Step back into the value string so the hover provider has a
            // token to resolve.
            for (let i = 0; i < 5; i++) {
                await window.keyboard.press('ArrowLeft')
            }
            await window.waitForTimeout(300)
            // Use the native show-hover keybinding directly. Going through
            // the palette would prefix with `>` and depend on fuzzy matching.
            await window.keyboard.press('ControlOrMeta+K')
            await window.keyboard.press('ControlOrMeta+I')
            await window.waitForTimeout(1_500)
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    // Timeline visualisation. The fixture provides a calm-timeline.json
    // alongside arch-v1/arch-v2, but neither opening the timeline document
    // directly nor opening an architecture in the same folder surfaces the
    // expected timeline bar in the preview pane. Likely requires either a
    // calm-mapping.json or a specific command that isn't documented yet.
    // Left as a TODO follow-up; the docs section describes timeline support
    // textually with a link to the timelines core-concept page.
    {
        name: '09-timeline',
        fixture: 'timeline',
        workspaceFile: 'arch-v1.json',
        description: 'Timeline navigation across architecture milestones.',
        implemented: false,
        async setup(window) {
            await openPreview(window)
            await window.waitForTimeout(2_500)
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    // Docify / template view: the preview panel has Docify, Template, and
    // Model tabs at the top. We open the preview, click the Template tab
    // header so live template rendering is shown alongside the architecture.
    // This is more reliable than triggering `CALM: Create Documentation
    // Website`, which prompts for an output directory.
    {
        name: '10-docify',
        fixture: 'docify-template',
        workspaceFile: 'architecture.json',
        description: 'Live documentation rendering in the preview Template tab.',
        implemented: true,
        async setup(window) {
            await openPreview(window)
            // The Template tab lives INSIDE the preview's webview frame, so
            // it can't be reached by a top-level page locator. Use the
            // inner-frame finder from frames.ts.
            const inner = findInnerWebviewFrame(window)
            if (inner) {
                const templateTab = inner.locator('text=Template').first()
                if ((await templateTab.count()) > 0) {
                    await templateTab.click()
                    await window.waitForTimeout(3_000)
                } else {
                    console.warn('[shoot]   Template tab not found inside webview frame')
                }
            } else {
                console.warn('[shoot]   inner webview frame not found')
            }
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },
]

export const implementedShots = shots.filter((s) => s.implemented)
