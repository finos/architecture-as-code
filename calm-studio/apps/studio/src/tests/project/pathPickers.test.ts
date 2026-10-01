// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	extensionsDirectoryHandleKey,
	isAbsoluteFsPath,
	normalizeProjectRelativePath,
} from '$lib/project/pathPickers';
import { createDefaultProjectConfig, isCalmProjectConfig } from '$lib/project/defaults';

describe('normalizeProjectRelativePath', () => {
	it('strips slashes and backslashes', () => {
		expect(normalizeProjectRelativePath('\\templates\\')).toBe('templates');
		expect(normalizeProjectRelativePath('/patterns/')).toBe('patterns');
	});
});

describe('extensions.dir paths', () => {
	it('keys granted handles by the configured folder', () => {
		expect(extensionsDirectoryHandleKey('C:/tmp/standards/')).toBe(
			'extensions-dir:C:/tmp/standards'
		);
		expect(isAbsoluteFsPath('C:/tmp/standards')).toBe(true);
	});
});

describe('patterns.dir in .calmrj', () => {
	it('accepts optional patterns.dir', () => {
		const cfg = createDefaultProjectConfig('onebank');
		expect(isCalmProjectConfig({ ...cfg, patterns: { dir: 'patterns' } })).toBe(true);
		expect(isCalmProjectConfig({ ...cfg, patterns: { dir: 1 } } as unknown)).toBe(false);
	});
});
