// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * menu.ts — Native menu bar construction for Tauri desktop.
 *
 * Builds the full application menu (File / Edit / View / Help) using
 * @tauri-apps/api/menu and sets it as the OS application menu.
 *
 * macOS constraint: all items must be inside Submenus — top-level loose items
 * are ignored on macOS. CmdOrCtrl accelerators are cross-platform.
 */

import { Menu, MenuItem, Submenu, PredefinedMenuItem } from '@tauri-apps/api/menu';

export interface MenuHandlers {
	open: () => void | Promise<void>;
	openFromPath: (path: string) => void | Promise<void>;
	save: () => void | Promise<void>;
	saveAs: () => void | Promise<void>;
	newFile: () => void | Promise<void>;
	exportCalm: () => void | Promise<void>;
	exportSvg: () => void | Promise<void>;
	exportPng: () => void | Promise<void>;
	undo: () => void | Promise<void>;
	redo: () => void | Promise<void>;
	zoomIn: () => void | Promise<void>;
	zoomOut: () => void | Promise<void>;
	zoomFit: () => void | Promise<void>;
	togglePalette: () => void | Promise<void>;
	toggleCode: () => void | Promise<void>;
	toggleProperties: () => void | Promise<void>;
	about: () => void | Promise<void>;
	docs: () => void | Promise<void>;
}

/** Module-level reference to the recent files submenu so it can be rebuilt. */
let recentFilesSubmenu: Submenu | null = null;

/**
 * Module-level callback for opening a file by path.
 * Set from handlers.openFromPath during buildAppMenu — used by recent file items.
 */
let _onOpenPath: ((path: string) => void | Promise<void>) | null = null;

/**
 * Build and set the native application menu.
 * Should be called once from onMount (after isTauri() guard).
 */
export async function buildAppMenu(handlers: MenuHandlers): Promise<void> {
	// Store the open-by-path callback for use by recent file item actions
	_onOpenPath = handlers.openFromPath;

	// ── File menu ────────────────────────────────────────────────────────────
	const recentItems = await _buildRecentItems([]);

	recentFilesSubmenu = await Submenu.new({
		text: 'Recent Files',
		items: recentItems,
	});

	const fileMenu = await Submenu.new({
		text: 'File',
		items: [
			await MenuItem.new({
				id: 'new',
				text: 'New',
				accelerator: 'CmdOrCtrl+N',
				action: () => { void handlers.newFile(); },
			}),
			await PredefinedMenuItem.new({ item: 'Separator' }),
			await MenuItem.new({
				id: 'open',
				text: 'Open...',
				accelerator: 'CmdOrCtrl+O',
				action: () => { void handlers.open(); },
			}),
			recentFilesSubmenu,
			await PredefinedMenuItem.new({ item: 'Separator' }),
			await MenuItem.new({
				id: 'save',
				text: 'Save',
				accelerator: 'CmdOrCtrl+S',
				action: () => { void handlers.save(); },
			}),
			await MenuItem.new({
				id: 'save-as',
				text: 'Save As...',
				accelerator: 'CmdOrCtrl+Shift+S',
				action: () => { void handlers.saveAs(); },
			}),
			await PredefinedMenuItem.new({ item: 'Separator' }),
			await MenuItem.new({
				id: 'export-calm',
				text: 'Export CALM JSON...',
				action: () => { void handlers.exportCalm(); },
			}),
			await MenuItem.new({
				id: 'export-svg',
				text: 'Export SVG...',
				action: () => { void handlers.exportSvg(); },
			}),
			await MenuItem.new({
				id: 'export-png',
				text: 'Export PNG...',
				action: () => { void handlers.exportPng(); },
			}),
			await PredefinedMenuItem.new({ item: 'Separator' }),
			await PredefinedMenuItem.new({ item: 'Quit' }),
		],
	});

	// ── Edit menu ─────────────────────────────────────────────────────────────
	const editMenu = await Submenu.new({
		text: 'Edit',
		items: [
			await PredefinedMenuItem.new({ item: 'Undo' }),
			await PredefinedMenuItem.new({ item: 'Redo' }),
			await PredefinedMenuItem.new({ item: 'Separator' }),
			await PredefinedMenuItem.new({ item: 'Cut' }),
			await PredefinedMenuItem.new({ item: 'Copy' }),
			await PredefinedMenuItem.new({ item: 'Paste' }),
			await PredefinedMenuItem.new({ item: 'SelectAll' }),
		],
	});

	// ── View menu ─────────────────────────────────────────────────────────────
	const viewMenu = await Submenu.new({
		text: 'View',
		items: [
			await MenuItem.new({
				id: 'zoom-in',
				text: 'Zoom In',
				accelerator: 'CmdOrCtrl+Equal',
				action: () => { void handlers.zoomIn(); },
			}),
			await MenuItem.new({
				id: 'zoom-out',
				text: 'Zoom Out',
				accelerator: 'CmdOrCtrl+Minus',
				action: () => { void handlers.zoomOut(); },
			}),
			await MenuItem.new({
				id: 'zoom-fit',
				text: 'Zoom to Fit',
				accelerator: 'CmdOrCtrl+0',
				action: () => { void handlers.zoomFit(); },
			}),
			await PredefinedMenuItem.new({ item: 'Separator' }),
			await MenuItem.new({
				id: 'toggle-palette',
				text: 'Toggle Palette',
				action: () => { void handlers.togglePalette(); },
			}),
			await MenuItem.new({
				id: 'toggle-code',
				text: 'Toggle Code Panel',
				action: () => { void handlers.toggleCode(); },
			}),
			await MenuItem.new({
				id: 'toggle-properties',
				text: 'Toggle Properties',
				action: () => { void handlers.toggleProperties(); },
			}),
		],
	});

	// ── Help menu ─────────────────────────────────────────────────────────────
	const helpMenu = await Submenu.new({
		text: 'Help',
		items: [
			await MenuItem.new({
				id: 'about',
				text: 'About CalmStudio',
				action: () => { void handlers.about(); },
			}),
			await MenuItem.new({
				id: 'docs',
				text: 'Documentation',
				action: () => { void handlers.docs(); },
			}),
		],
	});

	const menu = await Menu.new({
		items: [fileMenu, editMenu, viewMenu, helpMenu],
	});

	await menu.setAsAppMenu();
}

/**
 * Rebuild the Recent Files submenu with the given paths.
 * Call this after opening or saving a file to keep the menu current.
 */
export async function updateRecentFilesMenu(recentPaths: string[]): Promise<void> {
	if (!recentFilesSubmenu) return;

	// Remove all existing items from the end to avoid index shifting
	const existingItems = await recentFilesSubmenu.items();
	for (let i = existingItems.length - 1; i >= 0; i--) {
		await recentFilesSubmenu.removeAt(i);
	}

	// Append new items
	const newItems = await _buildRecentItems(recentPaths);
	for (const item of newItems) {
		await recentFilesSubmenu.append(item);
	}
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _buildRecentItems(
	paths: string[]
): Promise<Array<MenuItem>> {
	if (paths.length === 0) {
		return [
			await MenuItem.new({
				id: 'recent-empty',
				text: 'No Recent Files',
				enabled: false,
				action: () => {},
			}),
		];
	}

	const items: Array<MenuItem> = [];

	for (let i = 0; i < paths.length; i++) {
		const path = paths[i];
		const name = path.split(/[\\/]/).pop() ?? path;
		const displayPath = path.length > 60 ? '\u2026' + path.slice(-57) : path;
		const capturedPath = path;
		items.push(
			await MenuItem.new({
				id: `recent-${i}`,
				text: `${name}  (${displayPath})`,
				action: () => {
					if (_onOpenPath) void _onOpenPath(capturedPath);
				},
			})
		);
	}

	return items;
}
