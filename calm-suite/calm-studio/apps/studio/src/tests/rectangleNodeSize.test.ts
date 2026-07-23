// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
	estimateRectangleNodeSize,
	resolveRectangleNodeWidth,
	ARCHIMATE_ICON_WIDTH,
} from '$lib/canvas/rectangleNodeSize';

describe('estimateRectangleNodeSize', () => {
	it('returns minimum width for short labels', () => {
		const size = estimateRectangleNodeSize('A');
		expect(size.width).toBeGreaterThanOrEqual(90);
		expect(size.height).toBe(50);
	});

	it('grows width for long Archimate-style labels', () => {
		const short = estimateRectangleNodeSize('Node');
		const long = estimateRectangleNodeSize('Application Component');
		expect(long.width).toBeGreaterThan(short.width);
		expect(long.width).toBeGreaterThan(120);
	});

	it('adds space for reference icon and classification badge', () => {
		const base = estimateRectangleNodeSize('Service');
		const withRef = estimateRectangleNodeSize('Service', { hasReference: true });
		const withBoth = estimateRectangleNodeSize('Service', {
			hasReference: true,
			hasClassification: true,
		});
		expect(withRef.width).toBeGreaterThan(base.width);
		expect(withBoth.width).toBeGreaterThan(withRef.width);
	});

	it('uses wider icon slot for ArchiMate nodes', () => {
		const core = estimateRectangleNodeSize('Application Component');
		const archimate = estimateRectangleNodeSize('Application Component', {
			iconWidth: ARCHIMATE_ICON_WIDTH,
		});
		expect(archimate.width).toBeGreaterThan(core.width);
	});
});

describe('resolveRectangleNodeWidth', () => {
	it('uses estimated width when nothing is stored', () => {
		expect(resolveRectangleNodeWidth(undefined, 'Application Service')).toBe(
			estimateRectangleNodeSize('Application Service').width,
		);
	});

	it('keeps user-enlarged width', () => {
		const estimated = estimateRectangleNodeSize('Node').width;
		expect(resolveRectangleNodeWidth(400, 'Node')).toBe(400);
		expect(estimated).toBeLessThan(400);
	});

	it('grows stored width when label becomes longer', () => {
		const grown = resolveRectangleNodeWidth(120, 'Application Collaboration');
		expect(grown).toBeGreaterThan(120);
	});
});
