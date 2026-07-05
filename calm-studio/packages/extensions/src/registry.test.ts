// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from 'vitest';
import {
	registerPack,
	resolvePackNode,
	getAllPacks,
	getPacksForTypes,
	resetRegistry,
} from './registry.js';
import { corePack } from './packs/core.js';
import { initAllPacks } from './index.js';
import type { PackDefinition } from './types.js';

describe('PackRegistry', () => {
	beforeEach(() => {
		resetRegistry();
	});

	it('getAllPacks() returns empty array before any registration', () => {
		expect(getAllPacks()).toEqual([]);
	});

	it('registerPack(corePack) makes corePack retrievable via getAllPacks()', () => {
		registerPack(corePack);
		expect(getAllPacks()).toContain(corePack);
	});

	it('resolvePackNode("actor") returns null (core types are unprefixed)', () => {
		registerPack(corePack);
		expect(resolvePackNode('actor')).toBeNull();
	});

	it('resolvePackNode("aws:lambda") returns null when no AWS pack registered', () => {
		expect(resolvePackNode('aws:lambda')).toBeNull();
	});

	it('resolvePackNode("test:foo") returns the entry after registering a pack with that typeId', () => {
		const testPack: PackDefinition = {
			id: 'test',
			label: 'Test Pack',
			version: '1.0.0',
			color: { bg: '#fff', border: '#000', stroke: '#000' },
			nodes: [
				{
					typeId: 'test:foo',
					label: 'Foo',
					icon: '<svg/>',
					color: { bg: '#fff', border: '#000', stroke: '#000' },
				},
			],
		};
		registerPack(testPack);
		const result = resolvePackNode('test:foo');
		expect(result).not.toBeNull();
		expect(result?.typeId).toBe('test:foo');
	});

	it('getPacksForTypes returns unique pack IDs from colon-prefixed types, ignoring unprefixed', () => {
		const packs = getPacksForTypes(['aws:lambda', 'actor', 'k8s:pod']);
		expect(packs).toContain('aws');
		expect(packs).toContain('k8s');
		expect(packs).not.toContain('actor');
		expect(packs.length).toBe(2);
	});

	it('resetRegistry() clears all registered packs', () => {
		registerPack(corePack);
		expect(getAllPacks().length).toBeGreaterThan(0);
		resetRegistry();
		expect(getAllPacks()).toEqual([]);
	});
});

describe('corePack', () => {
	it('corePack.id === "core"', () => {
		expect(corePack.id).toBe('core');
	});

	it('corePack.nodes.length === 9', () => {
		expect(corePack.nodes.length).toBe(9);
	});

	it('corePack.nodes includes entries for all 9 CALM types', () => {
		const typeIds = corePack.nodes.map((n) => n.typeId);
		const expectedTypes = [
			'actor',
			'system',
			'service',
			'database',
			'network',
			'webclient',
			'ecosystem',
			'ldap',
			'data-asset',
		];
		for (const t of expectedTypes) {
			expect(typeIds).toContain(t);
		}
	});
});

describe('initAllPacks', () => {
	beforeEach(() => {
		resetRegistry();
	});

	it('initAllPacks() registers core pack', () => {
		initAllPacks();
		const packs = getAllPacks();
		expect(packs.some((p) => p.id === 'core')).toBe(true);
	});

	it('getAllPacks() returns 10 packs after initAllPacks()', () => {
		initAllPacks();
		expect(getAllPacks()).toHaveLength(10);
	});

	it('AWS pack has >= 30 node entries', () => {
		initAllPacks();
		const aws = getAllPacks().find((p) => p.id === 'aws');
		expect(aws).toBeDefined();
		expect(aws!.nodes.length).toBeGreaterThanOrEqual(30);
	});

	it('GCP pack has >= 15 node entries', () => {
		initAllPacks();
		const gcp = getAllPacks().find((p) => p.id === 'gcp');
		expect(gcp).toBeDefined();
		expect(gcp!.nodes.length).toBeGreaterThanOrEqual(15);
	});

	it('Azure pack has >= 15 node entries', () => {
		initAllPacks();
		const azure = getAllPacks().find((p) => p.id === 'azure');
		expect(azure).toBeDefined();
		expect(azure!.nodes.length).toBeGreaterThanOrEqual(15);
	});

	it('K8s pack has >= 14 node entries', () => {
		initAllPacks();
		const k8s = getAllPacks().find((p) => p.id === 'k8s');
		expect(k8s).toBeDefined();
		expect(k8s!.nodes.length).toBeGreaterThanOrEqual(14);
	});

	it('AI pack has >= 14 node entries', () => {
		initAllPacks();
		const ai = getAllPacks().find((p) => p.id === 'ai');
		expect(ai).toBeDefined();
		expect(ai!.nodes.length).toBeGreaterThanOrEqual(14);
	});

	it('resolvePackNode("aws:lambda") returns entry with label "Lambda"', () => {
		initAllPacks();
		const entry = resolvePackNode('aws:lambda');
		expect(entry).not.toBeNull();
		expect(entry!.label).toBe('Lambda');
	});

	it('resolvePackNode("k8s:pod") returns entry with label "Pod"', () => {
		initAllPacks();
		const entry = resolvePackNode('k8s:pod');
		expect(entry).not.toBeNull();
		expect(entry!.label).toBe('Pod');
	});

	it('resolvePackNode("ai:agent") returns entry with label "Agent"', () => {
		initAllPacks();
		const entry = resolvePackNode('ai:agent');
		expect(entry).not.toBeNull();
		expect(entry!.label).toBe('Agent');
	});

	it('resolvePackNode("gcp:cloud-run") returns entry with label "Cloud Run"', () => {
		initAllPacks();
		const entry = resolvePackNode('gcp:cloud-run');
		expect(entry).not.toBeNull();
		expect(entry!.label).toBe('Cloud Run');
	});

	it('resolvePackNode("azure:functions") returns entry with label "Functions"', () => {
		initAllPacks();
		const entry = resolvePackNode('azure:functions');
		expect(entry).not.toBeNull();
		expect(entry!.label).toBe('Functions');
	});

	it('every pack node has non-empty icon string', () => {
		initAllPacks();
		for (const pack of getAllPacks()) {
			for (const node of pack.nodes) {
				expect(node.icon.trim().length, `${node.typeId} icon is empty`).toBeGreaterThan(0);
			}
		}
	});

	it('every pack node has a valid PackColor (bg, border, stroke all non-empty)', () => {
		initAllPacks();
		for (const pack of getAllPacks()) {
			for (const node of pack.nodes) {
				expect(node.color.bg.trim().length, `${node.typeId} color.bg is empty`).toBeGreaterThan(0);
				expect(node.color.border.trim().length, `${node.typeId} color.border is empty`).toBeGreaterThan(0);
				expect(node.color.stroke.trim().length, `${node.typeId} color.stroke is empty`).toBeGreaterThan(0);
			}
		}
	});
});
