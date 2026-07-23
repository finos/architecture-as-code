// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, afterEach } from 'vitest';
import { inlineFlowEdgeStylesForExport } from '$lib/io/exportImagePrep';

describe('inlineFlowEdgeStylesForExport', () => {
	let container: HTMLDivElement;

	afterEach(() => {
		container?.remove();
	});

	it('inlines stroke on edge paths and restores on cleanup', () => {
		container = document.createElement('div');
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		path.setAttribute('class', 'svelte-flow__edge-path');
		path.setAttribute('d', 'M0 0 L10 10');
		svg.appendChild(path);
		container.appendChild(svg);
		document.body.appendChild(container);

		const restore = inlineFlowEdgeStylesForExport(container);
		expect(path.getAttribute('stroke')).toBeTruthy();
		expect(path.getAttribute('stroke-width')).toBeTruthy();
		expect(path.getAttribute('fill')).toBe('none');

		restore();
		expect(path.hasAttribute('stroke')).toBe(false);
		expect(path.hasAttribute('stroke-width')).toBe(false);
		expect(path.hasAttribute('fill')).toBe(false);
	});

	it('replaces currentColor on marker polygons', () => {
		container = document.createElement('div');
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
		const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
		marker.setAttribute('id', 'marker-arrow-filled');
		const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
		polygon.setAttribute('fill', 'currentColor');
		marker.appendChild(polygon);
		defs.appendChild(marker);
		svg.appendChild(defs);
		container.appendChild(svg);
		document.body.appendChild(container);

		const restore = inlineFlowEdgeStylesForExport(container);
		expect(polygon.getAttribute('fill')).toBe('#b1b1b7');
		restore();
		expect(polygon.getAttribute('fill')).toBe('currentColor');
	});
});
