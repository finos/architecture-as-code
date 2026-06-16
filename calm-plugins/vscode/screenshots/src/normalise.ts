// Make the workbench visually consistent before any screenshot is taken.
// Sets viewport, closes panels that would otherwise leak into shots, dismisses
// notifications. Run once at startup, then again between shots as a defensive
// reset.

import type { Page } from 'playwright'

export const DEFAULT_VIEWPORT = { width: 1600, height: 1000 } as const

export async function normaliseWorkbench(window: Page): Promise<void> {
    await window.setViewportSize(DEFAULT_VIEWPORT)

    // Close the auxiliary side bar (where Copilot Chat lives on default installs).
    // The command is a no-op if no aux bar is open.
    await runCommand(window, 'workbench.action.closeAuxiliaryBar')

    // Dismiss any visible notification toasts (welcome, update prompts, etc.).
    await runCommand(window, 'notifications.clearAll')

    // Settle.
    await window.waitForTimeout(300)
}

export async function runCommand(window: Page, commandId: string): Promise<void> {
    // Open Command Palette
    await window.keyboard.press('ControlOrMeta+Shift+P')
    await window.waitForSelector('.quick-input-widget', { timeout: 5_000 })

    // The palette opens with `>` prefix already. Type the command ID — VSCode
    // matches against the registered command ID strings.
    await window.keyboard.type(`>${commandId}`)
    await window.waitForTimeout(200)
    await window.keyboard.press('Enter')

    // Give the command a moment to run before the next palette open.
    await window.waitForTimeout(200)
}

// Trigger a command via its UI label (what shows in the palette) instead of its
// command ID. Use when the command ID isn't known or the title-cased label is
// more reliable.
export async function runCommandByTitle(window: Page, title: string): Promise<void> {
    await window.keyboard.press('ControlOrMeta+Shift+P')
    await window.waitForSelector('.quick-input-widget', { timeout: 5_000 })
    await window.keyboard.type(title)
    await window.waitForTimeout(300)
    await window.keyboard.press('Enter')
    await window.waitForTimeout(200)
}
