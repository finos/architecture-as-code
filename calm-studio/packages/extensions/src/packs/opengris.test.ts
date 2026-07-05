// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from 'vitest';
import { openGrisPack } from './opengris.js';
import { initAllPacks } from '../index.js';
import { getAllPacks, resolvePackNode, resetRegistry } from '../registry.js';

describe('openGrisPack', () => {
	it('openGrisPack has id "opengris"', () => {
		expect(openGrisPack.id).toBe('opengris');
	});

	it('openGrisPack has 8 node type entries', () => {
		expect(openGrisPack.nodes).toHaveLength(8);
	});

	it('every node entry has non-empty typeId, label, icon, color, description', () => {
		for (const node of openGrisPack.nodes) {
			expect(node.typeId.trim().length, `${node.typeId} typeId empty`).toBeGreaterThan(0);
			expect(node.label.trim().length, `${node.typeId} label empty`).toBeGreaterThan(0);
			expect(node.icon.trim().length, `${node.typeId} icon empty`).toBeGreaterThan(0);
			expect(node.color.bg.trim().length, `${node.typeId} color.bg empty`).toBeGreaterThan(0);
			expect(node.color.border.trim().length, `${node.typeId} color.border empty`).toBeGreaterThan(0);
			expect(node.color.stroke.trim().length, `${node.typeId} color.stroke empty`).toBeGreaterThan(0);
			expect(node.description?.trim().length ?? 0, `${node.typeId} description empty`).toBeGreaterThan(0);
		}
	});

	it('all typeIds start with "opengris:" prefix', () => {
		for (const node of openGrisPack.nodes) {
			expect(node.typeId, `${node.typeId} missing opengris: prefix`).toMatch(/^opengris:/);
		}
	});

	it('opengris:worker-manager has isContainer=true', () => {
		const workerManager = openGrisPack.nodes.find((n) => n.typeId === 'opengris:worker-manager');
		expect(workerManager).toBeDefined();
		expect(workerManager!.isContainer).toBe(true);
	});

	it('opengris:cluster has isContainer=true', () => {
		const cluster = openGrisPack.nodes.find((n) => n.typeId === 'opengris:cluster');
		expect(cluster).toBeDefined();
		expect(cluster!.isContainer).toBe(true);
	});

	it('no other OpenGRIS type has isContainer=true', () => {
		const containerNodes = openGrisPack.nodes.filter(
			(n) =>
				n.typeId !== 'opengris:worker-manager' &&
				n.typeId !== 'opengris:cluster' &&
				n.isContainer === true,
		);
		expect(containerNodes).toHaveLength(0);
	});

	it('opengris:cluster defaultChildren includes opengris:scheduler', () => {
		const cluster = openGrisPack.nodes.find((n) => n.typeId === 'opengris:cluster');
		expect(cluster).toBeDefined();
		expect(cluster!.defaultChildren).toContain('opengris:scheduler');
	});

	it('openGrisPack.color.bg is "#f0fdf4" (green family)', () => {
		expect(openGrisPack.color.bg).toBe('#f0fdf4');
	});
});

describe('OpenGRIS integration via initAllPacks', () => {
	beforeEach(() => {
		resetRegistry();
	});

	it('initAllPacks() registers 10 packs total', () => {
		initAllPacks();
		expect(getAllPacks()).toHaveLength(10);
	});

	it('resolvePackNode("opengris:scheduler") returns non-null after initAllPacks()', () => {
		initAllPacks();
		expect(resolvePackNode('opengris:scheduler')).not.toBeNull();
	});
});
