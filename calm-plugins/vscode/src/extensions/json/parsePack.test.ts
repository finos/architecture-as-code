import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePackJson } from './parsePack.js';
import { loadPacksFromDirectories, orderedPackDirectories } from './loadPacksFromFs.js';
import { loadBundledPackDocuments } from './bundledPacks.js';
import { initAllPacks } from '../index.js';
import { getAllPacks, resetRegistry } from '../registry.js';

const PACKS_DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../../extensions/packs'
);

const validPack = {
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

describe('parsePackJson (vscode)', () => {
	it('parses all 11 repo-root pack files', () => {
		const files = readdirSync(PACKS_DIR).filter((name) => name.endsWith('.extension.json'));
		expect(files).toHaveLength(11);
		for (const name of files) {
			const parsed = parsePackJson(JSON.parse(readFileSync(join(PACKS_DIR, name), 'utf8')));
			expect(parsed.ok, name).toBe(true);
		}
	});

	it('rejects invalid pack JSON', () => {
		expect(parsePackJson({ id: 'x' }).ok).toBe(false);
	});
});

describe('loadPacksFromDirectories', () => {
	it('skips missing dirs and loads later overwrite by id', () => {
		const dirA = mkdtempSync(join(tmpdir(), 'calm-packs-a-'));
		const dirB = mkdtempSync(join(tmpdir(), 'calm-packs-b-'));
		writeFileSync(join(dirA, 'orgpack.extension.json'), JSON.stringify(validPack));
		writeFileSync(
			join(dirB, 'orgpack.extension.json'),
			JSON.stringify({ ...validPack, label: 'Org overlay' })
		);
		const result = loadPacksFromDirectories([
			join(tmpdir(), 'calm-packs-missing'),
			dirA,
			dirB,
		]);
		expect(result.packs).toHaveLength(1);
		expect(result.packs[0]?.label).toBe('Org overlay');
	});

	it('skips corrupt JSON with a warning', () => {
		const dir = mkdtempSync(join(tmpdir(), 'calm-packs-bad-'));
		writeFileSync(join(dir, 'bad.extension.json'), '{ not json');
		const result = loadPacksFromDirectories([dir]);
		expect(result.packs).toHaveLength(0);
		expect(result.warnings.length).toBeGreaterThan(0);
	});
});

describe('orderedPackDirectories', () => {
	it('lists fallback, workspace extensions, external, then extra folders', () => {
		const dirs = orderedPackDirectories({
			fallbackDir: 'C:/vsix/packs',
			workspaceFolders: ['C:/repo'],
			externalAssetsPath: 'C:/shared',
			extraFolders: ['team/packs'],
		}).map((p) => p.replace(/\\/g, '/'));
		expect(dirs).toEqual([
			'C:/vsix/packs',
			'C:/repo/extensions',
			'C:/shared/extensions',
			'team/packs',
		]);
	});
});

describe('bundled initAllPacks', () => {
	it('loads 11 JSON packs including ArchiMate', () => {
		expect(loadBundledPackDocuments().length).toBe(11);
		resetRegistry();
		initAllPacks();
		expect(getAllPacks()).toHaveLength(11);
		expect(getAllPacks().some((p) => p.id === 'archimate')).toBe(true);
	});
});
