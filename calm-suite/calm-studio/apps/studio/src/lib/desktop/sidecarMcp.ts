// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * sidecarMcp.ts — MCP sidecar process lifecycle management.
 *
 * Starts the bundled calmstudio-mcp binary as a Tauri sidecar on app launch
 * and kills it on close. The sidecar binary must be compiled to a target-triple
 * named binary (see RESEARCH: Pitfall 2) and declared in tauri.conf.json
 * bundle.externalBin as 'binaries/calmstudio-mcp'.
 *
 * If the sidecar binary is absent (dev mode before MCP is packaged), the
 * start call logs a warning and returns without crashing the app.
 */

import { Command } from '@tauri-apps/plugin-shell';

/** Child process handle — stored at module level for cross-call access. */
let mcpChild: Awaited<ReturnType<ReturnType<typeof Command.sidecar>['spawn']>> | null = null;

/**
 * Start the MCP sidecar process.
 * Safe to call fire-and-forget — never throws (errors are logged to console).
 */
export async function startMcpSidecar(): Promise<void> {
	if (mcpChild !== null) {
		// Already running — no-op
		return;
	}

	try {
		const command = Command.sidecar('binaries/calmstudio-mcp');
		mcpChild = await command.spawn();
		console.info('[MCP] Sidecar started');
	} catch (e) {
		// Binary missing in dev mode — log and continue. App must not crash.
		console.warn('[MCP] Sidecar failed to start (binary may not be built yet):', e);
		mcpChild = null;
	}
}

/**
 * Stop the MCP sidecar process.
 * Should be called from the onMount cleanup / teardown function.
 * Safe to call even if sidecar never started.
 */
export async function stopMcpSidecar(): Promise<void> {
	if (mcpChild === null) return;

	try {
		await mcpChild.kill();
		console.info('[MCP] Sidecar stopped');
	} catch (e) {
		console.warn('[MCP] Failed to stop sidecar:', e);
	} finally {
		mcpChild = null;
	}
}
