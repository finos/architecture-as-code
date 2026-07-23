// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Prepare Svelte Flow DOM for SVG/PNG export.
 *
 * html-to-image serializes the viewport into a standalone SVG foreignObject.
 * Edge paths rely on CSS variables (--xy-edge-stroke) and markers use
 * currentColor — neither survives when the file is opened outside the app.
 * Inline explicit stroke/fill attributes before capture.
 */

const DEFAULT_EDGE_STROKE = '#b1b1b7';
const DEFAULT_EDGE_STROKE_WIDTH = '1';

type AttrRestore = { el: Element; attr: string; prev: string | null };

function setAttr(restores: AttrRestore[], el: Element, attr: string, value: string): void {
	restores.push({ el, attr, prev: el.getAttribute(attr) });
	el.setAttribute(attr, value);
}

function resolveEdgeStroke(path: SVGPathElement): string {
	const computed = getComputedStyle(path);
	const stroke = computed.stroke;
	if (stroke && stroke !== 'none' && stroke !== 'rgba(0, 0, 0, 0)') {
		return stroke;
	}
	return DEFAULT_EDGE_STROKE;
}

function resolveEdgeStrokeWidth(path: SVGPathElement): string {
	const computed = getComputedStyle(path);
	const width = computed.strokeWidth;
	if (width && width !== '0px') {
		return width.replace(/px$/, '');
	}
	return DEFAULT_EDGE_STROKE_WIDTH;
}

/**
 * Inline stroke attributes on edge paths and marker shapes inside `root`.
 * Returns a cleanup function that restores previous attributes.
 */
export function inlineFlowEdgeStylesForExport(root: HTMLElement): () => void {
	const restores: AttrRestore[] = [];

	root.querySelectorAll<SVGPathElement>('.svelte-flow__edge-path').forEach((path) => {
		setAttr(restores, path, 'stroke', resolveEdgeStroke(path));
		setAttr(restores, path, 'stroke-width', resolveEdgeStrokeWidth(path));
		setAttr(restores, path, 'fill', 'none');
		const opacity = getComputedStyle(path).strokeOpacity;
		if (opacity && opacity !== '1') {
			setAttr(restores, path, 'stroke-opacity', opacity);
		}
	});

	root.querySelectorAll<SVGElement>('marker polygon, marker polyline').forEach((shape) => {
		const fill = shape.getAttribute('fill');
		const stroke = shape.getAttribute('stroke');
		const color = root.querySelector<SVGPathElement>('.svelte-flow__edge-path')
			? resolveEdgeStroke(root.querySelector<SVGPathElement>('.svelte-flow__edge-path')!)
			: DEFAULT_EDGE_STROKE;

		if (fill === 'currentColor' || (shape.tagName === 'polygon' && !fill)) {
			setAttr(restores, shape, 'fill', color);
		}
		if (stroke === 'currentColor') {
			setAttr(restores, shape, 'stroke', color);
		}
	});

	return () => {
		for (const { el, attr, prev } of restores.reverse()) {
			if (prev === null) el.removeAttribute(attr);
			else el.setAttribute(attr, prev);
		}
	};
}
