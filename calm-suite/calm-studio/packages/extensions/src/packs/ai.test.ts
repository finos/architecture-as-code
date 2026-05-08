// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from 'vitest';
import { aiPack } from './ai.js';
import { initAllPacks } from '../index.js';
import { resolvePackNode, resetRegistry } from '../registry.js';

describe('aiPack', () => {
	it('aiPack has id "ai"', () => {
		expect(aiPack.id).toBe('ai');
	});

	it('every node entry has non-empty typeId, label, icon, color, description', () => {
		for (const node of aiPack.nodes) {
			expect(node.typeId.trim().length, `${node.typeId} typeId empty`).toBeGreaterThan(0);
			expect(node.label.trim().length, `${node.typeId} label empty`).toBeGreaterThan(0);
			expect(node.icon.trim().length, `${node.typeId} icon empty`).toBeGreaterThan(0);
			expect(node.color.bg.trim().length, `${node.typeId} color.bg empty`).toBeGreaterThan(0);
			expect(node.color.border.trim().length, `${node.typeId} color.border empty`).toBeGreaterThan(0);
			expect(node.color.stroke.trim().length, `${node.typeId} color.stroke empty`).toBeGreaterThan(0);
			expect(node.description?.trim().length ?? 0, `${node.typeId} description empty`).toBeGreaterThan(0);
		}
	});

	it('all typeIds start with "ai:" prefix', () => {
		for (const node of aiPack.nodes) {
			expect(node.typeId, `${node.typeId} missing ai: prefix`).toMatch(/^ai:/);
		}
	});

	it('aiPack contains ai:mcp-server entry', () => {
		const entry = aiPack.nodes.find((n) => n.typeId === 'ai:mcp-server');
		expect(entry).toBeDefined();
		expect(entry?.label).toBe('MCP Server');
		expect(entry?.icon.trim().length).toBeGreaterThan(0);
	});

	describe('after initAllPacks()', () => {
		beforeEach(() => {
			resetRegistry();
			initAllPacks();
		});

		it('resolvePackNode("ai:mcp-server") returns the entry from aiPack', () => {
			const entry = resolvePackNode('ai:mcp-server');
			expect(entry).not.toBeNull();
			expect(entry?.typeId).toBe('ai:mcp-server');
		});
	});
});
