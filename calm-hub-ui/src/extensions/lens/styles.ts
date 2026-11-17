import type { Theme } from '../../theme/useTheme.js';
import type { Border, ElementStyle, GroupStyle, Marker, Notation, RelationshipStyle, Shape } from '../../model/lens.js';

/** A notation, with Hub's core notation behind it. A short name is the notation's own first, then core. */
export interface ResolvedNotation {
    own: Notation;
    core: Notation;
}

function resolve<T>(own: Record<string, T> | undefined, core: Record<string, T> | undefined, reference: string): T | undefined {
    if (reference.startsWith('core/')) return core?.[reference.slice(5)];
    return own?.[reference] ?? core?.[reference];
}

export const findShape = (notation: ResolvedNotation, reference: string): Shape | undefined =>
    resolve(notation.own.shapes, notation.core.shapes, reference);

export const findMarker = (notation: ResolvedNotation, reference: string): Marker | undefined =>
    resolve(notation.own.markers, notation.core.markers, reference);

/** Hex colours, so that Hub can derive a stroke and check contrast. */
export const CANVAS: Record<Theme, { background: string; text: string; muted: string }> = {
    light: { background: '#ffffff', text: '#1e293b', muted: '#64748b' },
    dark: { background: '#0f172a', text: '#e2e8f0', muted: '#94a3b8' },
};

const NEUTRAL: Record<Theme, { background: string; color: string; stroke: string }> = {
    light: { background: '#f8fafc', color: '#1e293b', stroke: '#94a3b8' },
    dark: { background: '#1e293b', color: '#f1f5f9', stroke: '#64748b' },
};

export interface ComputedElementStyle {
    shape: string;
    background: string;
    color: string;
    stroke: string;
    accent: string;
    strokeWidth: number;
    border: Border;
    opacity: number;
    icon?: string;
    metadata: boolean;
    description: boolean;
}

export interface ComputedGroupStyle {
    shape?: string;
    background?: string;
    color: string;
    stroke: string;
    strokeWidth: number;
    border: Border;
    opacity: number;
    icon?: string;
}

export interface ComputedRelationshipStyle {
    color: string;
    thickness: number;
    style: Border;
    routing: 'direct' | 'curved' | 'orthogonal';
    opacity: number;
    start?: string;
    end?: string;
}

/** As in Structurizr: the styles apply in the order of the notation, and a later style overrides what it sets. */
function cascade<S extends { tag: string; dark?: object }>(styles: S[] | undefined, tags: readonly string[], theme: Theme): Partial<S> {
    const result: Partial<S> = {};
    for (const style of styles ?? []) {
        if (!tags.includes(style.tag)) continue;
        const dark = theme === 'dark' ? style.dark : undefined;
        for (const [key, value] of [...Object.entries(style), ...Object.entries(dark ?? {})]) {
            if (key !== 'tag' && key !== 'dark' && value !== undefined) (result as Record<string, unknown>)[key] = value;
        }
    }
    return result;
}

export function elementStyle(notation: ResolvedNotation, tags: readonly string[], theme: Theme): ComputedElementStyle {
    const style = cascade<ElementStyle>(notation.own.styles?.elements, tags, theme);
    const neutral = NEUTRAL[theme];
    const background = style.background ?? neutral.background;
    return {
        shape: style.shape !== undefined && findShape(notation, style.shape) ? style.shape : 'core/Box',
        background,
        color: readable(style.color ?? neutral.color, background),
        stroke: style.stroke ?? (style.background ? darken(background) : neutral.stroke),
        accent: style.accent ?? style.stroke ?? darken(background),
        strokeWidth: style.strokeWidth ?? 1,
        border: style.border ?? 'solid',
        opacity: (style.opacity ?? 100) / 100,
        icon: style.icon,
        metadata: style.metadata ?? true,
        description: style.description ?? true,
    };
}

export function groupStyle(notation: ResolvedNotation, tags: readonly string[], theme: Theme): ComputedGroupStyle {
    const style = cascade<GroupStyle>(notation.own.styles?.groups, tags, theme);
    const canvas = CANVAS[theme];
    return {
        shape: style.shape !== undefined && findShape(notation, style.shape) ? style.shape : undefined,
        background: style.background,
        color: readable(style.color ?? canvas.muted, style.background ?? canvas.background),
        stroke: style.stroke ?? NEUTRAL[theme].stroke,
        strokeWidth: style.strokeWidth ?? 1,
        border: style.border ?? 'dashed',
        opacity: (style.opacity ?? 100) / 100,
        icon: style.icon,
    };
}

export function relationshipStyle(notation: ResolvedNotation, tags: readonly string[], theme: Theme): ComputedRelationshipStyle {
    const style = cascade<RelationshipStyle>(notation.own.styles?.relationships, tags, theme);
    const marker = (reference: string | undefined) => (reference !== undefined && findMarker(notation, reference) ? reference : undefined);
    return {
        color: readable(style.color ?? NEUTRAL[theme].stroke, CANVAS[theme].background, 3),
        thickness: style.thickness ?? 1,
        style: style.style ?? 'solid',
        routing: style.routing ?? 'orthogonal',
        opacity: (style.opacity ?? 100) / 100,
        start: marker(style.start),
        end: 'end' in style ? marker(style.end) : 'arrow',
    };
}

/** An entry of the diagram key: each style of the notation that a node or an edge of this diagram uses. */
export interface KeyEntry {
    kind: 'element' | 'relationship';
    tag: string;
    label: string;
}

export function keyEntries(notation: ResolvedNotation, nodeTags: Set<string>, edgeTags: Set<string>): KeyEntry[] {
    const visible = (style: object) => Object.keys(style).some((key) => !['tag', 'label', 'metadata', 'description'].includes(key));
    const entries: KeyEntry[] = [];
    for (const style of notation.own.styles?.elements ?? []) {
        if (nodeTags.has(style.tag) && visible(style)) entries.push({ kind: 'element', tag: style.tag, label: style.label ?? style.tag });
    }
    for (const style of notation.own.styles?.relationships ?? []) {
        if (edgeTags.has(style.tag) && visible(style)) entries.push({ kind: 'relationship', tag: style.tag, label: style.label ?? style.tag });
    }
    return entries;
}

export const DASH: Record<Border, string | undefined> = { solid: undefined, dashed: '8 4', dotted: '2 3' };

function rgb(hex: string): [number, number, number] {
    const value = hex.length === 4 ? hex.slice(1).split('').map((digit) => digit + digit).join('') : hex.slice(1);
    return [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16)) as [number, number, number];
}

const toHex = (channels: number[]) => `#${channels.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;

export const darken = (hex: string, amount = 0.3) => toHex(rgb(hex).map((value) => value * (1 - amount)));

function luminance(hex: string): number {
    const [r, g, b] = rgb(hex).map((value) => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
}

/** The colour, or black or white when the colour does not reach the ratio on that background (WCAG AA). */
export function readable(color: string, background: string, ratio = 4.5): string {
    if (contrast(color, background) >= ratio) return color;
    return contrast('#000000', background) >= contrast('#ffffff', background) ? '#000000' : '#ffffff';
}
