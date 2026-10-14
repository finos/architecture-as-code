// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	addAdr,
	adrRelativeToFile,
	adrTabKey,
	adrTabLabel,
	parseHubAdr,
	loadAdrPreview,
	moveAdr,
	previewFromHub,
	previewFromMarkdown,
	readAdrs,
	removeAdr,
	replaceAdr,
} from '$lib/adr/adrs';
import { renderSafeMarkdown } from '$lib/adr/safeMarkdown';
import { rewriteArchitectureDocument } from '$lib/explorer/rewriteDetailedArchitecture';

describe('document adrs', () => {
	it('reads only strings and rejects empty edits', () => {
		expect(readAdrs({ adrs: ['a', 1, 'b'] })).toEqual(['a', 'b']);
		expect(replaceAdr(['a'], 0, '  ')).toBeNull();
		expect(replaceAdr(['a'], 0, 'b')).toEqual(['b']);
	});

	it('adds once, removes, and reorders', () => {
		expect(addAdr(['a'], 'a').duplicate).toBe(true);
		expect(addAdr(['a'], 'b').adrs).toEqual(['a', 'b']);
		expect(removeAdr(['a', 'b'], 0)).toEqual(['b']);
		expect(moveAdr(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
	});

	it('stores a path relative to the architecture file', () => {
		expect(adrRelativeToFile('components/c/coa/coa.json', 'docs/adr/one.md')).toBe(
			'../../../docs/adr/one.md'
		);
	});

	it('uses the hub URL as the tab key and a resolved local path otherwise', () => {
		const hub = 'http://localhost:8080/calm/namespaces/onebank/adrs/4';
		expect(adrTabKey(hub, 'components/c/coa/coa.json')).toBe(hub);
		expect(adrTabKey('../adr/one.md', 'components/c/coa/coa.json')).toBe('components/c/adr/one.md');
		expect(adrTabLabel(hub, 'Choose a store')).toBe('Choose a store');
		expect(adrTabLabel('docs/adr/one.md')).toBe('one.md');
	});

	it('rewrites relative adr links on folder move and leaves http links', () => {
		const doc = {
			nodes: [],
			adrs: ['../adr/one.md', 'http://hub/calm/namespaces/ns/adrs/1'],
		};
		const result = rewriteArchitectureDocument(
			doc,
			'old/folder/arch.json',
			'new/place/arch.json',
			'old/folder',
			'new/place'
		);
		expect(result.changed).toBe(true);
		expect((result.next as { adrs: string[] }).adrs).toEqual([
			'../../old/adr/one.md',
			'http://hub/calm/namespaces/ns/adrs/1',
		]);
	});
});

describe('adr preview', () => {
	it('renders markdown without executing html', async () => {
		const preview = previewFromMarkdown('one.md', '# Title\n\n<script>alert(1)</script>');
		expect(preview.title).toBe('Title');
		const html = renderSafeMarkdown(preview.markdown ?? '');
		expect(html).toContain('<h1>Title</h1>');
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
	});

	it('renders a markdown table and keeps cell html escaped', () => {
		const html = renderSafeMarkdown(
			'| Name | Status |\n| --- | ---: |\n| **Store** | accepted |\n| <b>Hub</b> | draft |'
		);
		expect(html).toContain('<table>');
		expect(html).toContain('<th>Name</th>');
		expect(html).toContain('<th style="text-align:right">Status</th>');
		expect(html).toContain('<strong>Store</strong>');
		expect(html).toContain('>accepted</td>');
		expect(html).toContain('&lt;b&gt;Hub&lt;/b&gt;');
		expect(html).not.toContain('<b>Hub</b>');
	});

	it('reads the Hub ADR envelope the same way Hub does', async () => {
		const hub = previewFromHub('http://hub/adrs/1', {
			namespace: 'onebank',
			id: 4,
			revision: 2,
			adr: {
				title: 'Store',
				status: 'accepted',
				contextAndProblemStatement: 'We need a **store**.',
				decisionDrivers: ['cost'],
				consideredOptions: [
					{
						name: 'SQL',
						description: 'A database',
						positiveConsequences: ['known'],
						negativeConsequences: ['ops'],
					},
				],
				decisionOutcome: {
					chosenOption: {
						name: 'SQL',
						description: 'A database',
						positiveConsequences: ['known'],
						negativeConsequences: [],
					},
					rationale: 'Fits.',
				},
				links: [{ rel: 'see', href: 'https://example.com' }],
			},
		});
		expect(hub.title).toBe('Store');
		expect(hub.hub?.status).toBe('accepted');
		expect(hub.hub?.context).toContain('store');
		expect(hub.hub?.drivers).toEqual(['cost']);
		expect(hub.hub?.options[0]?.name).toBe('SQL');
		expect(hub.hub?.outcome?.rationale).toBe('Fits.');
		expect(hub.hub?.links[0]).toEqual({ rel: 'see', href: 'https://example.com' });

		const flat = parseHubAdr({ title: 'Store', status: 'accepted', decisionDrivers: ['cost'] });
		expect(flat.title).toBe('Store');
		expect(flat.drivers).toEqual(['cost']);

		const missing = await loadAdrPreview('notes.md', 'arch/a.json', {
			readText: async () => {
				throw new Error('not found');
			},
			fetchHub: async () => ({}),
		});
		expect(missing.error).toBe('not found');
		expect(missing.kind).toBe('markdown');

		const other = await loadAdrPreview('notes.txt', 'arch/a.json', {
			readText: async () => 'hello',
			fetchHub: async () => ({}),
		});
		expect(other.kind).toBe('none');
		expect(other.error).toBeUndefined();
	});
});
