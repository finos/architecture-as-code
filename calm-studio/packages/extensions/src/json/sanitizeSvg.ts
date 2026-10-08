// SPDX-FileCopyrightText: 2026 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Fail-closed SVG sanitizer for pack icons.
 *
 * Icons are injected with Svelte `{@html}` (HTML parser, not XML). The returned
 * string is a re-serialization of an allowlisted tree, so the browser cannot
 * see a different document than the one we accepted.
 */

const MAX_SVG_LENGTH = 16_384;
const MAX_DEPTH = 8;

const ALLOWED_TAGS = new Set([
	'svg',
	'g',
	'path',
	'circle',
	'ellipse',
	'rect',
	'polygon',
	'polyline',
	'line',
]);

const NUM = '-?(?:\\d+\\.\\d+|\\d+)';
const NUMBER = new RegExp(`^${NUM}$`);
const VIEW_BOX = new RegExp(`^${NUM}(?:\\s+${NUM}){3}$`);
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.\-+]+$/;
const POINTS = new RegExp(`^${NUM}(?:[\\s,]+${NUM})+$`);
const DASH = new RegExp(`^(?:none|${NUM}(?:[\\s,]+${NUM})*)$`);
const COLOR = /^(?:none|currentColor|transparent|#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{4}|#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{8})$/;
const OPACITY = /^(?:0|1|0?\.\d+)$/;
const LINECAP = /^(?:butt|round|square)$/;
const LINEJOIN = /^(?:miter|round|bevel)$/;
const FILL_RULE = /^(?:nonzero|evenodd)$/;
const TRANSFORM =
	/^(?:(?:translate|scale|rotate|skewX|skewY|matrix)\(\s*-?(?:\d+\.\d+|\d+)(?:[\s,]+-?(?:\d+\.\d+|\d+))*\s*\)\s*)+$/;

const ATTR_VALUE: Record<string, RegExp> = {
	cx: NUMBER,
	cy: NUMBER,
	r: NUMBER,
	rx: NUMBER,
	ry: NUMBER,
	x: NUMBER,
	y: NUMBER,
	x1: NUMBER,
	y1: NUMBER,
	x2: NUMBER,
	y2: NUMBER,
	width: NUMBER,
	height: NUMBER,
	opacity: OPACITY,
	'fill-opacity': OPACITY,
	'stroke-opacity': OPACITY,
	'stroke-width': NUMBER,
	viewBox: VIEW_BOX,
	d: PATH_DATA,
	points: POINTS,
	fill: COLOR,
	stroke: COLOR,
	'stroke-dasharray': DASH,
	'stroke-linecap': LINECAP,
	'stroke-linejoin': LINEJOIN,
	'fill-rule': FILL_RULE,
	transform: TRANSFORM,
};

interface SvgEl {
	tag: string;
	attrs: Array<{ name: string; value: string }>;
	children: SvgEl[];
}

function isUnsafeUrl(value: string): boolean {
	return /javascript:|vbscript:|data:|url\s*\(|expression\s*\(/i.test(value);
}

function attrAllowed(name: string, value: string): boolean {
	if (name.startsWith('on') || isUnsafeUrl(value)) return false;
	const pattern = ATTR_VALUE[name];
	return !!pattern && pattern.test(value);
}

function parseAttr(
	src: string,
	i: number
): { name: string; value: string; end: number } | undefined {
	const start = i;
	if (!/[A-Za-z]/.test(src[i] ?? '')) return undefined;
	i += 1;
	while (i < src.length && /[A-Za-z0-9-]/.test(src[i] ?? '')) i += 1;
	const rawName = src.slice(start, i);
	const name = rawName === 'viewBox' ? 'viewBox' : rawName.toLowerCase();
	while (i < src.length && /[ \t\n\r]/.test(src[i] ?? '')) i += 1;
	if (src[i] !== '=') return undefined;
	i += 1;
	while (i < src.length && /[ \t\n\r]/.test(src[i] ?? '')) i += 1;
	const quote = src[i];
	if (quote !== '"' && quote !== "'") return undefined;
	i += 1;
	const valueStart = i;
	while (i < src.length && src[i] !== quote) {
		const ch = src[i] ?? '';
		if (ch === '<' || ch === '>' || ch === '&' || ch === '`' || ch === '\\') return undefined;
		i += 1;
	}
	if (src[i] !== quote) return undefined;
	return { name, value: src.slice(valueStart, i), end: i + 1 };
}

function parseEndTag(src: string, i: number, tag: string): number | undefined {
	if (src.slice(i, i + 2) !== '</') return undefined;
	i += 2;
	const start = i;
	while (i < src.length && /[A-Za-z0-9]/.test(src[i] ?? '')) i += 1;
	if (src.slice(start, i).toLowerCase() !== tag) return undefined;
	while (i < src.length && /[ \t\n\r]/.test(src[i] ?? '')) i += 1;
	if (src[i] !== '>') return undefined;
	return i + 1;
}

function parseElement(src: string, i: number, depth: number): { el: SvgEl; end: number } | undefined {
	if (depth > MAX_DEPTH || src[i] !== '<') return undefined;
	if (src.startsWith('</', i) || src.startsWith('<!', i) || src.startsWith('<?', i)) return undefined;
	i += 1;
	const nameStart = i;
	while (i < src.length && /[A-Za-z0-9]/.test(src[i] ?? '')) i += 1;
	if (i === nameStart) return undefined;
	const tag = src.slice(nameStart, i).toLowerCase();
	if (!ALLOWED_TAGS.has(tag)) return undefined;

	const attrs: Array<{ name: string; value: string }> = [];
	const seen = new Set<string>();
	for (;;) {
		if (i >= src.length) return undefined;
		const beforeWs = i;
		while (i < src.length && /[ \t\n\r]/.test(src[i] ?? '')) i += 1;
		if (i >= src.length) return undefined;
		if (src[i] === '>') {
			i += 1;
			return parseChildren(src, i, depth, tag, attrs);
		}
		if (src[i] === '/') {
			if (src[i + 1] !== '>') return undefined;
			return { el: { tag, attrs, children: [] }, end: i + 2 };
		}
		if (i === beforeWs) return undefined;
		const attr = parseAttr(src, i);
		if (!attr || seen.has(attr.name) || !attrAllowed(attr.name, attr.value)) return undefined;
		seen.add(attr.name);
		attrs.push({ name: attr.name, value: attr.value });
		i = attr.end;
	}
}

function parseChildren(
	src: string,
	i: number,
	depth: number,
	tag: string,
	attrs: Array<{ name: string; value: string }>
): { el: SvgEl; end: number } | undefined {
	const children: SvgEl[] = [];
	for (;;) {
		while (i < src.length && /[ \t\n\r]/.test(src[i] ?? '')) i += 1;
		if (i >= src.length) return undefined;
		if (src.startsWith('</', i)) {
			const end = parseEndTag(src, i, tag);
			if (end === undefined) return undefined;
			return { el: { tag, attrs, children }, end };
		}
		if (src[i] !== '<') return undefined;
		const child = parseElement(src, i, depth + 1);
		if (!child) return undefined;
		children.push(child.el);
		i = child.end;
	}
}

function escapeAttr(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function serialize(el: SvgEl): string {
	const attrs = el.attrs.map((attr) => ` ${attr.name}="${escapeAttr(attr.value)}"`).join('');
	if (el.children.length === 0) return `<${el.tag}${attrs}/>`;
	return `<${el.tag}${attrs}>${el.children.map(serialize).join('')}</${el.tag}>`;
}

/** @returns canonical SVG, or undefined when the input is not a safe icon. */
export function sanitizeInlineSvg(raw: string): string | undefined {
	if (raw.length === 0 || raw.length > MAX_SVG_LENGTH) return undefined;
	if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(raw)) return undefined;
	const src = raw.trim();
	const parsed = parseElement(src, 0, 0);
	if (!parsed || parsed.el.tag !== 'svg') return undefined;
	if (src.slice(parsed.end).trim() !== '') return undefined;
	return serialize(parsed.el);
}
