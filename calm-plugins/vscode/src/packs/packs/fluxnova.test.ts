// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from 'vitest';
import { fluxnovaPack } from './fluxnova.js';
import { initAllPacks } from '../index.js';
import { getAllPacks, resolvePackNode, resetRegistry } from '../registry.js';

describe('fluxnovaPack', () => {
	it('fluxnovaPack has id "fluxnova"', () => {
		expect(fluxnovaPack.id).toBe('fluxnova');
	});

	it('fluxnovaPack has 10 node type entries', () => {
		expect(fluxnovaPack.nodes).toHaveLength(10);
	});

	it('every node entry has non-empty typeId, label, icon, color, description', () => {
		for (const node of fluxnovaPack.nodes) {
			expect(node.typeId.trim().length, `${node.typeId} typeId empty`).toBeGreaterThan(0);
			expect(node.label.trim().length, `${node.typeId} label empty`).toBeGreaterThan(0);
			expect(node.icon.trim().length, `${node.typeId} icon empty`).toBeGreaterThan(0);
			expect(node.color.bg.trim().length, `${node.typeId} color.bg empty`).toBeGreaterThan(0);
			expect(node.color.border.trim().length, `${node.typeId} color.border empty`).toBeGreaterThan(0);
			expect(node.color.stroke.trim().length, `${node.typeId} color.stroke empty`).toBeGreaterThan(0);
			expect(node.description?.trim().length ?? 0, `${node.typeId} description empty`).toBeGreaterThan(0);
		}
	});

	it('all typeIds start with "fluxnova:" prefix', () => {
		for (const node of fluxnovaPack.nodes) {
			expect(node.typeId, `${node.typeId} missing fluxnova: prefix`).toMatch(/^fluxnova:/);
		}
	});

	it('fluxnova:platform has isContainer=true', () => {
		const platform = fluxnovaPack.nodes.find((n) => n.typeId === 'fluxnova:platform');
		expect(platform).toBeDefined();
		expect(platform!.isContainer).toBe(true);
	});

	it('no other FluxNova type has isContainer=true', () => {
		const containerNodes = fluxnovaPack.nodes.filter(
			(n) => n.typeId !== 'fluxnova:platform' && n.isContainer === true,
		);
		expect(containerNodes).toHaveLength(0);
	});

	it('fluxnovaPack.color.bg is "#fff7ed" (orange/amber family)', () => {
		expect(fluxnovaPack.color.bg).toBe('#fff7ed');
	});
});

describe('FluxNova integration via initAllPacks', () => {
	beforeEach(() => {
		resetRegistry();
	});

	it('initAllPacks() registers 10 packs total', () => {
		initAllPacks();
		expect(getAllPacks()).toHaveLength(10);
	});

	it('resolvePackNode("fluxnova:engine") returns non-null after initAllPacks()', () => {
		initAllPacks();
		expect(resolvePackNode('fluxnova:engine')).not.toBeNull();
	});
});
