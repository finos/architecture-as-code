// Declarative shot list. Each entry produces one PNG under docs/static/img/vscode/.
//
// Adding a shot: see AGENTS.md → "Common workflows → Add a shot".
//
// Status legend in comments:
//   IMPLEMENTED  — shoots reliably, output reviewed
//   TODO         — issue #2529 follow-up; entry stubbed so the structure is visible

import type { Page } from 'playwright'
import { runCommand, runCommandByTitle, resetForNextShot } from './normalise.js'
import { captureFullWindow } from './shoot.js'

export interface Shot {
    name: string
    fixture: string
    description: string
    implemented: boolean
    setup: (window: Page) => Promise<void>
    capture: (window: Page) => Promise<Buffer>
}

export const shots: Shot[] = [
    // IMPLEMENTED — CALM icon visible in the activity bar with the Model
    // Elements view focused. Uses the view-container command rather than
    // hunting a fragile aria-label selector.
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

    // IMPLEMENTED — Tree view expanded so children (Nodes / Relationships /
    // Flows) are visible. After opening the CALM view we focus the first
    // treeitem and walk down with ArrowRight to recursively expand the
    // top-level groups. We use the ARIA `treeitem` role rather than VSCode
    // internal classes — that selector is part of the accessibility
    // contract and survives version bumps.
    {
        name: '02-tree-view',
        fixture: 'three-tier',
        description: 'Model Elements tree with Nodes, Relationships, Flows expanded.',
        implemented: true,
        async setup(window) {
            await runCommand(window, 'workbench.view.extension.calm')
            await window.waitForTimeout(1_200)

            // Focus first tree item, then recursively expand top-level groups.
            const first = window.locator('[role="treeitem"]').first()
            await first.click()
            await window.waitForTimeout(200)

            // Expand root: Architecture → Nodes / Relationships / Flows
            await window.keyboard.press('ArrowRight')
            await window.waitForTimeout(300)

            // Expand each visible group. We walk down with ArrowDown +
            // ArrowRight; a closed leaf turns into a no-op, an open node
            // just moves focus.
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

    // TODO #2529 — Tree view with search active. Requires triggering the
    // calm.searchTreeView command and typing a query into the input that
    // appears. The command exists; the input wiring needs verifying.
    {
        name: '03-tree-search',
        fixture: 'three-tier',
        description: 'Search & filter in the Model Elements tree.',
        implemented: false,
        async setup(_window) {
            // TODO: trigger calm.searchTreeView, type 'service', wait for filter to apply.
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    // IMPLEMENTED — Preview panel side-by-side with the JSON editor. This is
    // the hero shot for the docs page. Validated in the spike.
    {
        name: '04-preview-hero',
        fixture: 'three-tier',
        description: 'Live preview of the architecture next to its JSON source.',
        implemented: true,
        async setup(window) {
            await runCommandByTitle(window, 'CALM: Open Preview')
            // Wait for the preview tab label to appear.
            await window.waitForFunction(
                () => {
                    const tabs = Array.from(document.querySelectorAll('.tab .tab-label'))
                    return tabs.some((t) => /preview/i.test(t.textContent || ''))
                },
                { timeout: 20_000 }
            )
            // Mermaid + ELK layout settles asynchronously.
            await window.waitForTimeout(4_000)
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    // TODO #2529 — Four-pane composite of light, dark, high-contrast-light,
    // high-contrast-dark themes. Each variant requires a separate VSCode
    // launch with the `calm.docify.theme` setting overridden, then the four
    // PNGs are composited (sharp or similar) into a single image. Out of
    // scope for the initial implementation.
    {
        name: '05-preview-themes',
        fixture: 'three-tier',
        description: 'Four-pane composite showing the four preview themes.',
        implemented: false,
        async setup(_window) {
            // TODO
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    // TODO #2529 — Side-by-side composite of ELK vs Dagre layout engines on
    // the same model. Same composite pattern as 05.
    {
        name: '06-preview-layout',
        fixture: 'three-tier',
        description: 'ELK vs Dagre layout engines on the same model.',
        implemented: false,
        async setup(_window) {
            // TODO
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    // IMPLEMENTED — Problems panel showing the diagnostics from an
    // intentionally-broken fixture. The fixtures/broken/architecture.json
    // file has nodes with missing required fields.
    {
        name: '07-validation-problems',
        fixture: 'broken',
        description: 'Real-time validation surfaces errors in the Problems panel.',
        implemented: true,
        async setup(window) {
            await runCommand(window, 'workbench.actions.view.problems')
            // Validation runs on open/save; give it time.
            await window.waitForTimeout(2_500)
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    // TODO #2529 — Hover an interactive node inside the rendered preview
    // diagram. Requires traversing into the inner webview frame (see
    // frames.ts) and dispatching a hover event on a node element.
    {
        name: '08-hover',
        fixture: 'three-tier',
        description: 'Hover info on a node inside the preview diagram.',
        implemented: false,
        async setup(_window) {
            // TODO: open preview, find inner webview frame, hover a node selector.
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    // TODO #2529 — Timeline navigation. Requires a multi-version fixture
    // with a calm-timeline.json document.
    {
        name: '09-timeline',
        fixture: 'three-tier',
        description: 'Timeline navigation across architecture milestones.',
        implemented: false,
        async setup(_window) {
            // TODO
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },

    // TODO #2529 — Live docify mode rendering a template alongside the model.
    // Requires a template fixture and triggering CALM: Create Documentation
    // Website (or the live-preview equivalent).
    {
        name: '10-docify',
        fixture: 'three-tier',
        description: 'Live documentation generation from a template.',
        implemented: false,
        async setup(_window) {
            // TODO
        },
        async capture(window) {
            return await captureFullWindow(window)
        },
    },
]

export const implementedShots = shots.filter((s) => s.implemented)

// Re-export for symmetric imports in the orchestrator.
export { resetForNextShot }
