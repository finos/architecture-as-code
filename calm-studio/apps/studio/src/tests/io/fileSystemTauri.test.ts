// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * fileSystemTauri.test.ts — Unit tests for Tauri-specific file I/O.
 *
 * Uses the Tauri mockIPC pattern (from @tauri-apps/api/mocks) to intercept
 * IPC calls without a real Tauri webview. Tests cover open, save, saveAs,
 * and the user-cancel paths for each dialog.
 *
 * DESK-02: Native open dialog returns path + reads content
 * DESK-02: Native save dialog writes content to path
 */

import { mockIPC, clearMocks, mockWindows } from '@tauri-apps/api/mocks';
import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { openFileTauri, saveFileTauri, saveFileAsTauri } from '$lib/io/fileSystemTauri';

beforeAll(() => mockWindows('main'));
afterEach(() => clearMocks());

describe('openFileTauri', () => {
	it('calls dialog open, reads file content via IPC, returns { content, name, handle: path }', async () => {
		// readTextFile invokes 'plugin:fs|read_text_file' and expects an ArrayBuffer/Uint8Array
		// back (the Tauri Rust side returns raw bytes; the JS side decodes with TextDecoder).
		const fileContent = '{"nodes":[],"relationships":[]}';
		const fileBytes = new TextEncoder().encode(fileContent);

		mockIPC((cmd) => {
			if (cmd === 'plugin:dialog|open') return '/home/user/arch.calm.json';
			if (cmd === 'plugin:fs|read_text_file') return Array.from(fileBytes);
		});

		const result = await openFileTauri();

		expect(result.content).toBe('{"nodes":[],"relationships":[]}');
		expect(result.name).toBe('arch.calm.json');
		expect(result.handle).toBe('/home/user/arch.calm.json');
	});

	it('throws when user cancels dialog (dialog returns null)', async () => {
		mockIPC((cmd) => {
			if (cmd === 'plugin:dialog|open') return null;
		});

		await expect(openFileTauri()).rejects.toThrow();
	});
});

describe('saveFileTauri', () => {
	it('writes content to the given path via IPC and returns the path', async () => {
		const content = '{"nodes":[],"relationships":[]}';
		const path = '/home/user/arch.calm.json';

		mockIPC((cmd) => {
			if (cmd === 'plugin:fs|write_text_file') return undefined;
		});

		const result = await saveFileTauri(content, path);

		expect(result).toBe(path);
	});
});

describe('saveFileAsTauri', () => {
	it('calls save dialog, writes file, returns the path selected by user', async () => {
		const content = '{"nodes":[],"relationships":[]}';
		const suggestedName = 'my-arch.calm.json';

		mockIPC((cmd) => {
			if (cmd === 'plugin:dialog|save') return '/home/user/new.calm.json';
			if (cmd === 'plugin:fs|write_text_file') return undefined;
		});

		const result = await saveFileAsTauri(content, suggestedName);

		expect(result).toBe('/home/user/new.calm.json');
	});

	it('returns null when user cancels save dialog', async () => {
		const content = '{"nodes":[],"relationships":[]}';

		mockIPC((cmd) => {
			if (cmd === 'plugin:dialog|save') return null;
		});

		const result = await saveFileAsTauri(content, 'arch.calm.json');

		expect(result).toBeNull();
	});
});
