// SPDX-FileCopyrightText: 2026 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { duplicateTypeIdWarnings, parsePackJson } from './parsePack.js';
import { loadBundledPackDocuments } from './bundledPacks.js';
import { registerPackDocuments } from './registerPackDocuments.js';
import { initAllPacks, resetToBundledPacks } from '../index.js';
import { getAllPacks, resetRegistry } from '../registry.js';

const PACKS_DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../../extensions/packs'
);

describe('parsePackJson', () => {
	it('maps all repo-root extension JSON files and sets schemaUrl from standard.$id', () => {
		const files = readdirSync(PACKS_DIR).filter((name) => name.endsWith('.extension.json'));
		expect(files.length).toBe(11);
		for (const name of files) {
			const parsed = parsePackJson(JSON.parse(readFileSync(join(PACKS_DIR, name), 'utf8')));
			expect(parsed.ok, name).toBe(true);
			if (!parsed.ok) continue;
			expect(parsed.pack.schemaUrl).toBeTruthy();
			expect(parsed.pack.relationships?.length).toBeGreaterThan(0);
		}
	});

	it('sets AI schemaUrl to the proposed Standard $id', () => {
		const parsed = parsePackJson(
			JSON.parse(readFileSync(join(PACKS_DIR, 'ai.extension.json'), 'utf8'))
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.pack.schemaUrl).toBe('https://calm.finos.org/extensions/ai/ai.standard.json');
	});

	it('core pack schemaUrl is the CALM 1.2 meta-schema', () => {
		const parsed = parsePackJson(
			JSON.parse(readFileSync(join(PACKS_DIR, 'core.extension.json'), 'utf8'))
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.pack.schemaUrl).toBe('https://calm.finos.org/release/1.2/meta/calm.json');
		expect(parsed.pack.standardHref).toBeUndefined();
	});

	it('rejects a document missing required fields', () => {
		const parsed = parsePackJson({ id: 'x' });
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.errors.length).toBeGreaterThan(0);
	});

	it('duplicateTypeIdWarnings reports collisions across pack ids', () => {
		const warnings = duplicateTypeIdWarnings([
			{
				id: 'a',
				label: 'A',
				version: '1.0.0',
				color: { bg: '#fff', border: '#000', stroke: '#000' },
				nodes: [
					{
						typeId: 'a:x',
						label: 'X',
						icon: '<svg/>',
						color: { bg: '#fff', border: '#000', stroke: '#000' },
					},
				],
			},
			{
				id: 'b',
				label: 'B',
				version: '1.0.0',
				color: { bg: '#fff', border: '#000', stroke: '#000' },
				nodes: [
					{
						typeId: 'a:x',
						label: 'X',
						icon: '<svg/>',
						color: { bg: '#fff', border: '#000', stroke: '#000' },
					},
				],
			},
		]);
		expect(warnings.some((w) => w.includes('a:x'))).toBe(true);
	});

	it('maps optional node and relationship fields', () => {
		const parsed = parsePackJson({
			$schema: 'https://calm.finos.org/schemas/calm-extension-pack.schema.json',
			id: 'extra',
			label: 'Extra',
			version: '1.0.0',
			standard: {
				$id: 'https://example.invalid/extra.standard.json',
				href: '../standards/extra.standard.json',
			},
			color: { bg: '#ffffff', border: '#000000', stroke: '#000000', badge: '[X]' },
			nodes: [
				{
					typeId: 'extra:box',
					label: 'Box',
					icon: { href: './box.svg', mediaType: 'image/svg+xml' },
					color: { bg: '#ffffff', border: '#000000', stroke: '#000000' },
					description: 'A box',
					isContainer: true,
					rectangleLayout: true,
					defaultChildren: ['extra:child', 1, ''],
					defaults: { metadata: { owner: 'team' } },
				},
			],
			relationships: [
				{
					typeId: 'connects',
					label: 'Connects',
					description: 'link',
					calmCoreVariant: 'connects',
				},
			],
			relationshipDefaults: { metadata: { kind: 'assoc' } },
		});
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		const node = parsed.pack.nodes[0]!;
		expect(node.icon).toBe('./box.svg');
		expect(node.isContainer).toBe(true);
		expect(node.rectangleLayout).toBe(true);
		expect(node.defaultChildren).toEqual(['extra:child']);
		expect(node.defaults?.metadata).toEqual({ owner: 'team' });
		expect(parsed.pack.standardHref).toBe('../standards/extra.standard.json');
		expect(parsed.pack.relationshipDefaults?.metadata).toEqual({ kind: 'assoc' });
		expect(parsed.pack.relationships?.[0]?.description).toBe('link');
		expect(parsed.pack.relationships?.[0]?.calmCoreVariant).toBe('connects');
	});

	it('rejects invalid colors, icons, and relationship variants', () => {
		const parsed = parsePackJson({
			$schema: 'https://calm.finos.org/schemas/calm-extension-pack.schema.json',
			id: 'bad',
			label: 'Bad',
			version: '1.0.0',
			standard: { $id: 'https://example.invalid/bad.standard.json' },
			color: { bg: 'blue', border: '#000', stroke: '#000' },
			nodes: [
				{
					typeId: 'bad:x',
					label: 'X',
					icon: '',
					color: { bg: '#fff', border: '#000', stroke: '#000' },
				},
			],
			relationships: [
				{ typeId: 'r', label: 'R', calmCoreVariant: 'not-a-variant' },
				'nope',
			],
		});
		expect(parsed.ok).toBe(false);
	});

	it('rejects a non-object document', () => {
		expect(parsePackJson(null).ok).toBe(false);
		expect(parsePackJson([]).ok).toBe(false);
	});

	it('rejects empty arrays and non-object entries', () => {
		const parsed = parsePackJson({
			$schema: 'https://calm.finos.org/schemas/calm-extension-pack.schema.json',
			id: 'Bad_id',
			label: '',
			version: '1',
			standard: { href: './x.json' },
			color: 'red',
			nodes: ['nope', { typeId: '', label: '', icon: { mediaType: 'image/png' }, color: 'nope' }],
			relationships: [],
		});
		expect(parsed.ok).toBe(false);
	});
});

describe('bundled JSON via initAllPacks', () => {
	it('Vite glob finds 11 pack documents', () => {
		expect(loadBundledPackDocuments()).toHaveLength(11);
	});

	it('resetToBundledPacks restores JSON packs after overlay', () => {
		resetRegistry();
		initAllPacks();
		registerPackDocuments([
			{
				source: 'overlay',
				value: {
					$schema: 'https://calm.finos.org/schemas/calm-extension-pack.schema.json',
					id: 'overlay',
					label: 'Overlay',
					version: '1.0.0',
					standard: { $id: 'https://example.invalid/o.json' },
					color: { bg: '#ffffff', border: '#000000', stroke: '#000000' },
					nodes: [
						{
							typeId: 'overlay:n',
							label: 'N',
							icon: '<svg/>',
							color: { bg: '#ffffff', border: '#000000', stroke: '#000000' },
						},
					],
					relationships: [{ typeId: 'connects', label: 'Connects' }],
				},
			},
		]);
		expect(getAllPacks().some((p) => p.id === 'overlay')).toBe(true);
		resetToBundledPacks();
		expect(getAllPacks().some((p) => p.id === 'overlay')).toBe(false);
		expect(getAllPacks()).toHaveLength(11);
	});

	it('registerPackDocuments skips invalid files', () => {
		resetRegistry();
		const warn = vi.fn();
		const result = registerPackDocuments(
			[{ source: 'bad.json', value: { id: 'nope' } }],
			warn
		);
		expect(result.registered).toBe(0);
		expect(result.warnings[0]).toContain('bad.json');
		expect(warn).toHaveBeenCalledOnce();
	});
});
