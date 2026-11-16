import type { LensNode, Part, Pin, Port, Shape, Slot } from '../../model/lens.js';

export const FONT_SIZE = { small: 11, normal: 13, large: 16 } as const;
export const LINE_HEIGHT = 1.3;

/**
 * An estimate of the text width, so that layout gives the same result in every browser and in tests. Hub sets the
 * font, so the estimate is close; the slot clips what is over.
 */
export function textWidth(text: string, size: number, bold = false): number {
    return text.length * size * (bold ? 0.6 : 0.55);
}

/** Wraps text into lines that fit the width. A word longer than the width breaks. */
export function wrap(text: string, width: number, size: number, bold = false): string[] {
    const perLine = Math.max(1, Math.floor(width / textWidth('x', size, bold)));
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
        let line = '';
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
            for (let rest = word; rest; ) {
                const candidate = line ? `${line} ${rest}` : rest;
                if (candidate.length <= perLine) {
                    line = candidate;
                    rest = '';
                } else if (line) {
                    lines.push(line);
                    line = '';
                } else {
                    lines.push(rest.slice(0, perLine));
                    rest = rest.slice(perLine);
                }
            }
        }
        lines.push(line);
    }
    return lines;
}

/** At most `max` lines; the last line ends with an ellipsis when text is cut. */
export function clamp(lines: string[], max: number, width: number, size: number, bold = false): string[] {
    if (lines.length <= max) return lines;
    const kept = lines.slice(0, Math.max(1, max));
    const last = kept[kept.length - 1];
    const perLine = Math.max(1, Math.floor(width / textWidth('x', size, bold)));
    kept[kept.length - 1] = `${last.slice(0, Math.max(0, Math.min(last.length, perLine - 1)))}…`;
    return kept;
}

/** One line, cut with an ellipsis when it is too wide. */
export function fitLine(text: string, width: number, size: number, bold = false): string {
    const perLine = Math.max(1, Math.floor(width / textWidth('x', size, bold)));
    return text.length <= perLine ? text : `${text.slice(0, Math.max(0, perLine - 1))}…`;
}

const slotFont = (slot: Slot) => FONT_SIZE[slot.size ?? 'normal'];
const lineHeight = (slot: Slot) => slotFont(slot) * LINE_HEIGHT;

/** The text of a slot: label, metadata and description are node fields, and other names come from `fields`. */
export function slotText(node: LensNode, name: string, show: { metadata: boolean; description: boolean }): string | undefined {
    if (name === 'label') return node.label;
    if (name === 'metadata') return show.metadata ? node.metadata : undefined;
    if (name === 'description') return show.description ? node.description : undefined;
    return node.fields?.[name];
}

/** A band of the shape, in shape units, that grows by `extra` pixels to fit its text. */
interface Band {
    start: number;
    end: number;
    extra: number;
}

/** The size of a node and the map from shape units to its pixels. */
export interface Fitted {
    width: number;
    height: number;
    x: (u: number) => number;
    y: (v: number) => number;
    /** Scale of lengths such as radii and stroke widths. */
    sx: number;
    sy: number;
    /** Translation for a pinned part, which keeps its size. */
    pin: (pin: Pin) => [number, number];
}

function axis(u: number, from: number, to: number, mode: 'stretch' | 'nine-slice', start = 0, end = 0): number {
    if (mode === 'nine-slice' && to >= start + end && from > start + end) {
        if (u <= start) return u;
        if (u >= from - end) return to - (from - u);
        return start + ((u - start) * (to - start - end)) / (from - start - end);
    }
    return (u * to) / from;
}

function withBands(v: number, bands: Band[]): number {
    let shift = 0;
    for (const band of bands) {
        if (v >= band.end) shift += band.extra;
        else if (v > band.start) shift += (band.extra * (v - band.start)) / (band.end - band.start);
    }
    return v + shift;
}

/**
 * Sizes a shape for a node. A `grow` slot and each `list` slot take the height that their text needs, and the shape
 * grows by that much inside the band of the slot, so the parts above and below keep their place. An `aspect` shape
 * keeps its ratio and does not grow.
 */
export function fitShape(shape: Shape, node?: LensNode, show = { metadata: true, description: true }, width?: number, height?: number): Fitted {
    const [minX, minY, vw, vh] = shape.viewBox;
    const mode = shape.resize?.mode ?? 'stretch';
    const [minW, minH] = shape.minSize ?? [vw, vh];
    const w = Math.max(width ?? Math.max(vw, minW), 1);
    const sx0 = w / vw;
    const bands: Band[] = [];
    if (node && mode !== 'aspect') {
        for (const [name, slot] of Object.entries(shape.slots ?? {})) {
            if (!slot.grow && slot.kind !== 'list') continue;
            const lines = slot.kind === 'list'
                ? (node.sections?.[name]?.length ?? 0)
                : wrap(slotText(node, name, show) ?? '', slot.width * sx0, slotFont(slot), slot.weight === 'bold').filter(Boolean).length;
            const extra = lines * lineHeight(slot) - slot.height;
            if (extra > 0) bands.push({ start: slot.y - minY, end: slot.y - minY + slot.height, extra });
        }
    }
    const grown = vh + bands.reduce((sum, band) => sum + band.extra, 0);
    const h = Math.max(height ?? Math.max(grown, minH), 1);
    const [top, right, bottom, left] = shape.resize?.insets ?? [0, 0, 0, 0];
    if (mode === 'aspect') {
        const s = Math.min(w / vw, h / vh);
        const ox = (w - vw * s) / 2;
        const oy = (h - vh * s) / 2;
        return {
            width: w, height: h, sx: s, sy: s,
            x: (u) => ox + (u - minX) * s,
            y: (v) => oy + (v - minY) * s,
            pin: (pin) => pinOffset(pin, w - vw, h - vh),
        };
    }
    const nine = mode === 'nine-slice';
    return {
        width: w,
        height: h,
        sx: nine ? 1 : w / vw,
        sy: nine ? 1 : h / grown,
        x: (u) => axis(u - minX, vw, w, mode, left, right),
        y: (v) => axis(withBands(v - minY, bands), grown, h, mode, top, bottom),
        pin: (pin) => pinOffset(pin, w - vw, h - vh),
    };
}

function pinOffset(pin: Pin, dw: number, dh: number): [number, number] {
    const fx = pin.endsWith('left') ? 0 : pin.endsWith('right') ? 1 : 0.5;
    const fy = pin.startsWith('top') ? 0 : pin.startsWith('bottom') ? 1 : 0.5;
    return [fx * dw, fy * dh];
}

const PATH_TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
const ARGS: Record<string, number> = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7, Z: 0 };

/**
 * Maps path data through the fit. Each command becomes absolute, so that each point maps on its own: a nine-slice
 * map is not linear. Hub checked the grammar at start-up.
 */
export function mapPath(data: string, x: (u: number) => number, y: (v: number) => number, sx: number, sy: number): string {
    const tokens = [...data.matchAll(PATH_TOKEN)];
    const out: string[] = [];
    let cx = 0, cy = 0, startX = 0, startY = 0;
    let at = 0;
    while (at < tokens.length) {
        const letter = tokens[at++][1];
        if (!letter) continue;
        const upper = letter.toUpperCase();
        const relative = letter !== upper;
        const count = ARGS[upper];
        if (count === 0) {
            out.push('Z');
            [cx, cy] = [startX, startY];
            continue;
        }
        let first = true;
        while (at < tokens.length && tokens[at][2] !== undefined) {
            const n = tokens.slice(at, at + count).map((token) => Number(token[2]));
            at += count;
            const command = upper === 'M' && !first ? 'L' : upper;
            const px = (value: number) => (relative ? cx + value : value);
            const py = (value: number) => (relative ? cy + value : value);
            const point = (i: number) => [px(n[i]), py(n[i + 1])];
            const emit = (points: number[][]) => points.map(([u, v]) => `${round(x(u))} ${round(y(v))}`).join(' ');
            let end: number[];
            switch (command) {
                case 'H': end = [px(n[0]), cy]; out.push(`L${emit([end])}`); break;
                case 'V': end = [cx, py(n[0])]; out.push(`L${emit([end])}`); break;
                case 'A':
                    end = point(5);
                    out.push(`A${round(n[0] * sx)} ${round(n[1] * sy)} ${n[2]} ${n[3]} ${n[4]} ${emit([end])}`);
                    break;
                default: {
                    const points = [];
                    for (let i = 0; i < count; i += 2) points.push(point(i));
                    end = points[points.length - 1];
                    out.push(`${command}${emit(points)}`);
                }
            }
            [cx, cy] = end;
            if (command === 'M') [startX, startY] = end;
            first = false;
        }
    }
    return out.join(' ');
}

const round = (value: number) => Math.round(value * 100) / 100;

/** One part in node pixels, ready for an SVG element. */
export type PlacedPart =
    | { kind: 'path'; d: string }
    | { kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number; ry?: number }
    | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
    | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
    | { kind: 'polyline' | 'polygon'; points: string };

export function placePart(part: Part, fit: Fitted, viewBox: [number, number, number, number]): PlacedPart | undefined {
    let { x, y, sx, sy } = fit;
    if (part.pin) {
        const [dx, dy] = fit.pin(part.pin);
        x = (u) => u - viewBox[0] + dx;
        y = (v) => v - viewBox[1] + dy;
        sx = sy = 1;
    }
    const points = (list: [number, number][]) => list.map(([u, v]) => `${round(x(u))},${round(y(v))}`).join(' ');
    if (part.path !== undefined) return { kind: 'path', d: mapPath(part.path, x, y, sx, sy) };
    if (part.rect) {
        const { x: rx0, y: ry0, width, height, rx, ry } = part.rect;
        const left = x(rx0), top = y(ry0);
        return {
            kind: 'rect', x: left, y: top, width: x(rx0 + width) - left, height: y(ry0 + height) - top,
            rx: rx === undefined ? undefined : rx * sx, ry: ry === undefined ? (rx === undefined ? undefined : rx * sy) : ry * sy,
        };
    }
    if (part.circle) return { kind: 'ellipse', cx: x(part.circle.cx), cy: y(part.circle.cy), rx: part.circle.r * sx, ry: part.circle.r * sy };
    if (part.ellipse) return { kind: 'ellipse', cx: x(part.ellipse.cx), cy: y(part.ellipse.cy), rx: part.ellipse.rx * sx, ry: part.ellipse.ry * sy };
    if (part.line) return { kind: 'line', x1: x(part.line.x1), y1: y(part.line.y1), x2: x(part.line.x2), y2: y(part.line.y2) };
    if (part.polyline) return { kind: 'polyline', points: points(part.polyline) };
    if (part.polygon) return { kind: 'polygon', points: points(part.polygon) };
    return undefined;
}

/** The text of a slot, as lines at their baselines, in node pixels. */
export interface PlacedText {
    lines: { text: string; x: number; y: number }[];
    anchor: 'start' | 'middle' | 'end';
    size: number;
    bold: boolean;
}

export function placeSlot(slot: Slot, fit: Fitted, content: string | string[] | undefined): PlacedText | undefined {
    if (content === undefined || content.length === 0) return undefined;
    const left = fit.x(slot.x), right = fit.x(slot.x + slot.width);
    const top = fit.y(slot.y), bottom = fit.y(slot.y + slot.height);
    const size = slotFont(slot);
    const bold = slot.weight === 'bold';
    const height = lineHeight(slot);
    const width = right - left;
    const max = Math.max(1, Math.floor((bottom - top) / height + 0.01));
    const raw = Array.isArray(content) ? content.map((row) => fitLine(row, width, size, bold)) : wrap(content, width, size, bold);
    const lines = clamp(raw, max, width, size, bold);
    const used = lines.length * height;
    const valign = slot.valign ?? 'top';
    const first = valign === 'top' ? top : valign === 'bottom' ? bottom - used : top + (bottom - top - used) / 2;
    const align = slot.align ?? 'start';
    const anchor = align === 'center' ? 'middle' : align;
    const ax = align === 'start' ? left : align === 'end' ? right : (left + right) / 2;
    return {
        lines: lines.map((text, index) => ({ text, x: ax, y: first + index * height + size * 0.95 })),
        anchor,
        size,
        bold,
    };
}

/** The point halfway along a line, where an edge label goes when the layout did not place it. */
export function midpoint(points: { x: number; y: number }[]) {
    const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    let half = lengths.reduce((sum, length) => sum + length, 0) / 2;
    for (let i = 0; i < lengths.length; i++) {
        if (half <= lengths[i] && lengths[i] > 0) {
            const t = half / lengths[i];
            return { x: points[i].x + (points[i + 1].x - points[i].x) * t, y: points[i].y + (points[i + 1].y - points[i].y) * t };
        }
        half -= lengths[i];
    }
    return points[0];
}

/** A named port, in node pixels. */
export function portPoint(port: Port, width: number, height: number): { x: number; y: number } {
    const offset = port.offset ?? 0.5;
    switch (port.side) {
        case 'top': return { x: offset * width, y: 0 };
        case 'bottom': return { x: offset * width, y: height };
        case 'left': return { x: 0, y: offset * height };
        case 'right': return { x: width, y: offset * height };
    }
}
