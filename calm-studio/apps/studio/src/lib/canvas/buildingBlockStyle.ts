// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/** VS Code / Hub per-node color override (R49). */

export interface NodeStyleOverride {
	background?: string;
	text?: string;
}

function readStyleObject(metadata: unknown): Record<string, unknown> | undefined {
	if (!metadata || typeof metadata !== 'object') return undefined;
	const rec = metadata as Record<string, unknown>;
	const style = rec['building-block-style'] ?? rec['fidelity-style'];
	if (!style || typeof style !== 'object') return undefined;
	return style as Record<string, unknown>;
}

export function getNodeStyleOverride(metadata: unknown): NodeStyleOverride {
	const style = readStyleObject(metadata);
	if (!style) return {};
	const out: NodeStyleOverride = {};
	if (typeof style.background === 'string' && style.background) out.background = style.background;
	if (typeof style.text === 'string' && style.text) out.text = style.text;
	return out;
}

export function writeNodeStyleOverride(
	metadata: Record<string, unknown> | undefined,
	override: NodeStyleOverride
): Record<string, unknown> {
	const next = { ...(metadata ?? {}) };
	const background = override.background?.trim() ?? '';
	const text = override.text?.trim() ?? '';
	if (!background && !text) {
		delete next['building-block-style'];
		return next;
	}
	next['building-block-style'] = {
		...(background ? { background } : {}),
		...(text ? { text } : {}),
	};
	return next;
}

export function nodeStyleOverrideCss(metadata: unknown): string {
	const style = getNodeStyleOverride(metadata);
	const parts: string[] = [];
	if (style.background) parts.push(`background: ${style.background}`);
	if (style.text) parts.push(`color: ${style.text}`);
	return parts.join('; ');
}

/** Set fill/label CSS variables used by icon-style nodes. */
export function nodeStyleOverrideVars(
	metadata: unknown,
	backgroundVar: string,
	strokeVar?: string
): string {
	const style = getNodeStyleOverride(metadata);
	const parts: string[] = [];
	if (style.background) {
		parts.push(`${backgroundVar}: ${style.background}`);
		if (strokeVar) parts.push(`${strokeVar}: ${style.background}`);
	}
	if (style.text) parts.push(`--node-label-color: ${style.text}`);
	return parts.join('; ');
}
