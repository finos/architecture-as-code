// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	computeExportImageLayout,
	computeNodesBounds,
	exportLayoutCoversBounds,
	EXPORT_MAX_DIMENSION,
	EXPORT_MIN_ZOOM,
} from '$lib/io/exportImageLayout';

describe('computeNodesBounds', () => {
	it('returns zero bounds for empty nodes', () => {
		expect(computeNodesBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
	});

	it('covers all nodes including those outside a typical viewport', () => {
		const bounds = computeNodesBounds([
			{ id: 'a', position: { x: 0, y: 0 }, width: 100, height: 50 },
			{ id: 'b', position: { x: 3000, y: 2000 }, width: 200, height: 80 },
		]);
		expect(bounds.x).toBe(0);
		expect(bounds.y).toBe(0);
		expect(bounds.width).toBe(3200);
		expect(bounds.height).toBe(2080);
	});

	it('accounts for nested parent offsets', () => {
		const bounds = computeNodesBounds([
			{ id: 'parent', position: { x: 100, y: 50 }, width: 400, height: 300 },
			{
				id: 'child',
				position: { x: 20, y: 30 },
				width: 100,
				height: 40,
				parentId: 'parent',
			},
		]);
		// child absolute = (120, 80) .. (220, 120); parent (100,50)..(500,350)
		expect(bounds.x).toBe(100);
		expect(bounds.y).toBe(50);
		expect(bounds.width).toBe(400);
		expect(bounds.height).toBe(300);
	});

	it('prefers measured dimensions when present', () => {
		const bounds = computeNodesBounds([
			{
				id: 'a',
				position: { x: 0, y: 0 },
				width: 10,
				height: 10,
				measured: { width: 250, height: 60 },
			},
		]);
		expect(bounds.width).toBe(250);
		expect(bounds.height).toBe(60);
	});
});

describe('computeExportImageLayout — full diagram (no crop)', () => {
	it('covers a small diagram', () => {
		const bounds = { x: 0, y: 0, width: 400, height: 300 };
		const layout = computeExportImageLayout(bounds);
		expect(exportLayoutCoversBounds(layout, bounds)).toBe(true);
		expect(layout.width).toBeGreaterThanOrEqual(400);
		expect(layout.height).toBeGreaterThanOrEqual(300);
	});

	it('covers a diagram larger than the old fixed 1920×1080 canvas', () => {
		const bounds = { x: -200, y: 100, width: 5000, height: 3500 };
		const layout = computeExportImageLayout(bounds);
		expect(exportLayoutCoversBounds(layout, bounds)).toBe(true);
		// Must not use the old minZoom=0.5 clamp that cropped large diagrams
		expect(layout.zoom).toBeGreaterThanOrEqual(EXPORT_MIN_ZOOM);
	});

	it('covers widely scattered nodes (simulates zoomed-in viewport crop bug)', () => {
		const nodes = [
			{ id: 'nw', position: { x: -500, y: -400 }, width: 180, height: 70 },
			{ id: 'se', position: { x: 4200, y: 3100 }, width: 220, height: 90 },
			{ id: 'mid', position: { x: 1800, y: 1400 }, width: 160, height: 50 },
		];
		const bounds = computeNodesBounds(nodes);
		const layout = computeExportImageLayout(bounds);
		expect(exportLayoutCoversBounds(layout, bounds)).toBe(true);
		expect(layout.transform).toMatch(/^translate\(.+\) scale\(.+\)$/);
	});

	it('never exceeds max canvas dimension', () => {
		const bounds = { x: 0, y: 0, width: 50_000, height: 40_000 };
		const layout = computeExportImageLayout(bounds);
		expect(layout.width).toBeLessThanOrEqual(EXPORT_MAX_DIMENSION);
		expect(layout.height).toBeLessThanOrEqual(EXPORT_MAX_DIMENSION);
		expect(exportLayoutCoversBounds(layout, bounds)).toBe(true);
	});

	it('old fixed 1920×1080 + minZoom 0.5 would crop — new layout must not', () => {
		const bounds = { x: 0, y: 0, width: 6000, height: 4000 };
		// Simulate legacy behaviour
		const legacyWidth = 1920;
		const legacyHeight = 1080;
		const legacyMinZoom = 0.5;
		const pad = 0.1;
		const xZoom = (legacyWidth * (1 - pad * 2)) / bounds.width;
		const yZoom = (legacyHeight * (1 - pad * 2)) / bounds.height;
		const neededZoom = Math.min(xZoom, yZoom);
		expect(neededZoom).toBeLessThan(legacyMinZoom); // proves old clamp would crop

		const layout = computeExportImageLayout(bounds);
		expect(exportLayoutCoversBounds(layout, bounds)).toBe(true);
	});
});

describe('exportAsSvg / exportAsPng capture wiring', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	it('exportAsSvg captures with full-diagram layout size, not viewport size', async () => {
		const toSvg = vi.fn(async () => 'data:image/svg+xml,test');
		vi.doMock('html-to-image', () => ({ toSvg, toPng: vi.fn() }));

		const downloadDataUrl = vi.fn();
		vi.doMock('$lib/io/fileSystem', () => ({ downloadDataUrl }));

		vi.doMock('$lib/io/exportImagePrep', () => ({
			inlineFlowEdgeStylesForExport: () => () => {},
		}));

		const viewport = document.createElement('div');
		viewport.className = 'svelte-flow__viewport';
		document.body.appendChild(viewport);

		const { exportAsSvg } = await import('$lib/io/export');
		const nodes = [
			{ id: 'a', position: { x: 0, y: 0 }, width: 100, height: 50, data: {} },
			{ id: 'b', position: { x: 4000, y: 3000 }, width: 100, height: 50, data: {} },
		];

		await exportAsSvg(nodes as never);

		expect(toSvg).toHaveBeenCalledTimes(1);
		const opts = toSvg.mock.calls[0][1] as {
			width: number;
			height: number;
			style: { width: string; height: string; transform: string };
		};
		// Must be larger than a typical pane viewport crop (e.g. 800×600)
		expect(opts.width).toBeGreaterThan(2000);
		expect(opts.height).toBeGreaterThan(1500);
		expect(opts.style.transform).toContain('translate');
		expect(opts.style.transform).toContain('scale');
		expect(downloadDataUrl).toHaveBeenCalledWith('data:image/svg+xml,test', 'architecture.svg');
	});

	it('exportAsPng uses full-diagram layout and pixelRatio 2', async () => {
		const toPng = vi.fn(async () => 'data:image/png;base64,abc');
		vi.doMock('html-to-image', () => ({ toSvg: vi.fn(), toPng }));

		const downloadDataUrl = vi.fn();
		vi.doMock('$lib/io/fileSystem', () => ({ downloadDataUrl }));

		vi.doMock('$lib/io/exportImagePrep', () => ({
			inlineFlowEdgeStylesForExport: () => () => {},
		}));

		const viewport = document.createElement('div');
		viewport.className = 'svelte-flow__viewport';
		document.body.appendChild(viewport);

		const { exportAsPng } = await import('$lib/io/export');
		const nodes = [
			{ id: 'a', position: { x: -100, y: -50 }, width: 180, height: 70, data: {} },
			{ id: 'b', position: { x: 2500, y: 1800 }, width: 200, height: 80, data: {} },
		];

		await exportAsPng(nodes as never);

		expect(toPng).toHaveBeenCalledTimes(1);
		const opts = toPng.mock.calls[0][1] as {
			width: number;
			height: number;
			pixelRatio: number;
			style: { transform: string };
		};
		expect(opts.pixelRatio).toBe(2);
		expect(opts.width).toBeGreaterThan(1500);
		expect(opts.height).toBeGreaterThan(1000);
		expect(opts.style.transform).toMatch(/translate\(.+\) scale\(.+\)/);
		expect(downloadDataUrl).toHaveBeenCalledWith(
			'data:image/png;base64,abc',
			'architecture.png'
		);
	});

	it('throws when there are no nodes', async () => {
		vi.doMock('html-to-image', () => ({ toSvg: vi.fn(), toPng: vi.fn() }));
		vi.doMock('$lib/io/fileSystem', () => ({ downloadDataUrl: vi.fn() }));
		vi.doMock('$lib/io/exportImagePrep', () => ({
			inlineFlowEdgeStylesForExport: () => () => {},
		}));

		const viewport = document.createElement('div');
		viewport.className = 'svelte-flow__viewport';
		document.body.appendChild(viewport);

		const { exportAsSvg } = await import('$lib/io/export');
		await expect(exportAsSvg([])).rejects.toThrow(/no nodes/i);
	});
});
