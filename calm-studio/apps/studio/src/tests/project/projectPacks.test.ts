// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExplorerTreeEntry } from '$lib/explorer/types';
import { createDefaultProjectConfig } from '$lib/project/defaults';
import { applyProjectPacks, packScanDirs } from '$lib/project/projectPacks';
import { getAllPacks, resetRegistry } from '@calmstudio/extensions';
import { isAbsoluteFsPath, normalizeExtensionsDir } from '$lib/project/pathPickers';

vi.mock('$lib/explorer/folderScan', () => ({
	scanDirectoryTree: vi.fn(),
}));

vi.mock('$lib/explorer/folderPersistence', () => ({
	loadNamedDirectoryHandle: vi.fn(async () => null),
	ensureReadPermission: vi.fn(async () => true),
}));

import { scanDirectoryTree } from '$lib/explorer/folderScan';
import { loadNamedDirectoryHandle } from '$lib/explorer/folderPersistence';

const extraPack = {
	$schema: 'https://calm.finos.org/schemas/calm-extension-pack.schema.json',
	id: 'orgpack',
	label: 'Org',
	version: '1.0.0',
	standard: { $id: 'https://example.invalid/org.standard.json' },
	color: { bg: '#ffffff', border: '#000000', stroke: '#000000' },
	nodes: [
		{
			typeId: 'orgpack:widget',
			label: 'Widget',
			icon: '<svg/>',
			color: { bg: '#ffffff', border: '#000000', stroke: '#000000' },
		},
	],
	relationships: [{ typeId: 'connects', label: 'Connects', calmCoreVariant: 'connects' }],
};

function jsonEntry(relativePath: string, value: unknown): ExplorerTreeEntry {
	const name = relativePath.split('/').pop() ?? relativePath;
	return {
		kind: 'file',
		name,
		relativePath,
		handle: {
			kind: 'file',
			getFile: async () =>
				({
					text: async () => JSON.stringify(value),
				}) as File,
		} as FileSystemFileHandle,
		isCalm: false,
		nodesLoaded: false,
	};
}

function configWithExtensionsDir(dir: string) {
	return { ...createDefaultProjectConfig('model'), extensions: { dir } };
}

describe('packScanDirs', () => {
	it('always includes project extensions/', () => {
		expect(packScanDirs(undefined)).toEqual(['extensions']);
	});

	it('adds a distinct extra dir after extensions/', () => {
		expect(packScanDirs('team/packs')).toEqual(['extensions', 'team/packs']);
	});

	it('does not scan extensions twice when extra dir is extensions', () => {
		expect(packScanDirs('extensions')).toEqual(['extensions']);
	});

	it('keeps a Windows absolute extra dir', () => {
		expect(packScanDirs('C:/Users/kamil/work/git/difa/CEngineering-App/standards')).toEqual([
			'extensions',
			'C:/Users/kamil/work/git/difa/CEngineering-App/standards',
		]);
	});
});

describe('isAbsoluteFsPath', () => {
	it('detects Windows, Unix, and file URLs', () => {
		expect(isAbsoluteFsPath('C:/Users/kamil/work/standards')).toBe(true);
		expect(isAbsoluteFsPath('C:\\Users\\kamil\\work\\standards')).toBe(true);
		expect(isAbsoluteFsPath('/home/kamil/standards')).toBe(true);
		expect(isAbsoluteFsPath('file:///tmp/standards')).toBe(true);
		expect(isAbsoluteFsPath('standards')).toBe(false);
		expect(isAbsoluteFsPath('extensions/extra')).toBe(false);
	});

	it('normalizes trailing slashes without dropping the drive', () => {
		expect(normalizeExtensionsDir('C:/tmp/standards/')).toBe('C:/tmp/standards');
	});
});

describe('applyProjectPacks', () => {
	beforeEach(() => {
		resetRegistry();
		vi.mocked(scanDirectoryTree).mockReset();
		vi.mocked(loadNamedDirectoryHandle).mockReset();
		vi.mocked(loadNamedDirectoryHandle).mockResolvedValue(null);
	});

	it('overlays a project pack and overwrites bundled ids', async () => {
		vi.mocked(scanDirectoryTree).mockResolvedValue([
			jsonEntry('extensions/orgpack.extension.json', extraPack),
		]);
		const root = {} as FileSystemDirectoryHandle;
		const result = await applyProjectPacks(root, createDefaultProjectConfig('model'));
		expect(result.warnings).toEqual([]);
		expect(getAllPacks().some((p) => p.id === 'orgpack')).toBe(true);
		expect(getAllPacks().some((p) => p.id === 'core')).toBe(true);
	});

	it('loads packs from .calmrj extensions.dir inside the project', async () => {
		vi.mocked(scanDirectoryTree).mockResolvedValue([
			jsonEntry('standards/difa-arch.extension.json', extraPack),
		]);
		const root = {} as FileSystemDirectoryHandle;
		const result = await applyProjectPacks(root, configWithExtensionsDir('standards'));
		expect(result.warnings).toEqual([]);
		expect(result.loaded).toBe(1);
		expect(getAllPacks().some((p) => p.id === 'orgpack')).toBe(true);
	});

	it('warns when an absolute extensions.dir has no granted folder handle', async () => {
		vi.mocked(scanDirectoryTree).mockResolvedValue([]);
		const root = {} as FileSystemDirectoryHandle;
		const abs = 'C:/Users/kamil/work/git/difa/CEngineering-App/standards';
		const result = await applyProjectPacks(root, configWithExtensionsDir(abs));
		expect(result.loaded).toBe(0);
		expect(result.warnings.some((w) => w.includes(abs) && w.includes('Browse'))).toBe(true);
		expect(getAllPacks().some((p) => p.id === 'core')).toBe(true);
		expect(getAllPacks().some((p) => p.id === 'orgpack')).toBe(false);
	});

	it('loads packs from a granted handle for an absolute extensions.dir', async () => {
		const extraHandle = { name: 'standards' } as FileSystemDirectoryHandle;
		vi.mocked(scanDirectoryTree).mockImplementation(async (handle) => {
			if (handle === extraHandle) {
				return [jsonEntry('difa-arch.extension.json', extraPack)];
			}
			return [];
		});
		const abs = 'C:/Users/kamil/work/git/difa/CEngineering-App/standards';
		const result = await applyProjectPacks(
			{} as FileSystemDirectoryHandle,
			configWithExtensionsDir(abs),
			new Map([[abs, extraHandle]])
		);
		expect(result.warnings).toEqual([]);
		expect(result.loaded).toBe(1);
		expect(getAllPacks().some((p) => p.id === 'orgpack')).toBe(true);
	});

	it('skips invalid pack JSON with a warning', async () => {
		vi.mocked(scanDirectoryTree).mockResolvedValue([
			jsonEntry('extensions/bad.extension.json', { id: 'nope' }),
		]);
		const root = {} as FileSystemDirectoryHandle;
		const result = await applyProjectPacks(root, createDefaultProjectConfig('model'));
		expect(result.loaded).toBe(0);
		expect(result.warnings.some((w) => w.includes('bad.extension.json'))).toBe(true);
		expect(getAllPacks().some((p) => p.id === 'core')).toBe(true);
	});

	it('hides bundled packs in extensions.disabled and keeps extra dir packs', async () => {
		vi.mocked(scanDirectoryTree).mockResolvedValue([
			jsonEntry('extensions/orgpack.extension.json', extraPack),
		]);
		const cfg = createDefaultProjectConfig('model');
		cfg.extensions = { disabled: ['core', 'orgpack'] };
		const result = await applyProjectPacks({} as FileSystemDirectoryHandle, cfg);
		expect(result.loaded).toBe(1);
		expect(getAllPacks().some((p) => p.id === 'core')).toBe(false);
		expect(getAllPacks().some((p) => p.id === 'orgpack')).toBe(true);
	});
});
