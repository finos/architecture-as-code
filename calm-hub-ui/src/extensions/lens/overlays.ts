import type { Decorator, DecoratorView, ElementOverlay, OverlayEntry, ViewOverlay } from '../../visualizer/contracts/contracts.js';
import type { ShownOverlay } from '../../visualizer/context/DecoratorOverlayContext.js';
import { OVERLAY_STATUSES, containersOfContainment, hasOverlay, overlayByElement, statusText } from '../../visualizer/overlay/overlayEngine.js';
import { OVERLAY_STYLES } from '../../visualizer/components/reactflow/overlay/overlayStyle.js';
import { textWidth } from './geometry.js';
import type { LensReply } from '../../model/lens.js';

/** The key of a lens element in a lens overlay. Nodes, groups and edges have separate id spaces. */
export const lensOverlayKey = (kind: 'node' | 'group' | 'edge', id: string) => `${kind}:${id}`;

export interface LensViewOverlay extends ViewOverlay {
    /** The CALM elements with a decorator of the view that no lens element names in `calm`. */
    notDrawn: string[];
}

/**
 * What each overlay view draws on the elements of a lens reply. A lens element shows the decorators of the CALM
 * elements in its `calm` list and nothing else: the overlay engine finds the decorators of each CALM element, with
 * containment relationships folded into their container as on the CALM diagram, and a lens element joins those of
 * its ids. A decorator that names several of those ids counts once. A CALM element that no lens element names is
 * listed in `notDrawn`, so the view can say so instead of moving its decorators to another element.
 */
export function lensOverlays(
    views: readonly DecoratorView[],
    decorators: Decorator[],
    relationships: unknown,
    graph: LensReply['graph'],
): LensViewOverlay[] {
    const drawnAs = containersOfContainment(relationships);
    const elements: [string, string[]][] = [
        ...graph.nodes.map((node) => [lensOverlayKey('node', node.id), node.calm ?? []] as [string, string[]]),
        ...graph.groups.map((group) => [lensOverlayKey('group', group.id), group.calm ?? []] as [string, string[]]),
        ...graph.edges.map((edge) => [lensOverlayKey('edge', edge.id), edge.calm ?? []] as [string, string[]]),
    ];
    const named = new Set(elements.flatMap(([, calm]) => calm));
    return views.filter(hasOverlay).flatMap((view) => {
        const byCalm = overlayByElement(view, decorators, drawnAs);
        if (byCalm.size === 0) return [];
        const shown = new Map<string, ElementOverlay>();
        for (const [key, calm] of elements) {
            const entries = [...new Set(calm.flatMap((id) => byCalm.get(id)?.entries ?? []))];
            if (entries.length === 0) continue;
            // Worst first, as the engine orders the entries of one element. The sort is stable within a status.
            entries.sort((a: OverlayEntry, b: OverlayEntry) => OVERLAY_STATUSES.indexOf(a.status) - OVERLAY_STATUSES.indexOf(b.status));
            shown.set(key, { status: entries[0].status, value: entries[0].value, entries });
        }
        return [{ view, elements: shown, notDrawn: [...byCalm.keys()].filter((id) => !named.has(id)) }];
    });
}

export const LENS_BADGE_HEIGHT = 18;
export const LENS_BADGE_TEXT = 10;
const GAP = 4;

const badgeWidth = ({ overlay }: ShownOverlay) => 6 + 7 + 4 + textWidth(`${OVERLAY_STYLES[overlay.status].glyph} ${statusText(overlay.value)}`, LENS_BADGE_TEXT, true) + 6;

export interface PlacedBadge {
    shown: ShownOverlay;
    x: number;
    y: number;
    width: number;
}

/**
 * Places the badges of one element in rows of at most `maxWidth`, from the top `y` down. Each row lines up at `x` by
 * `align`. A badge wider than `maxWidth` has a row of its own.
 */
export function placeBadges(shown: ShownOverlay[], x: number, y: number, align: 'start' | 'middle' | 'end', maxWidth: number): PlacedBadge[] {
    const rows: { shown: ShownOverlay; width: number }[][] = [];
    let used = 0;
    for (const entry of shown) {
        const width = badgeWidth(entry);
        const row = rows[rows.length - 1];
        if (row && used + GAP + width <= maxWidth) {
            row.push({ shown: entry, width });
            used += GAP + width;
        } else {
            rows.push([{ shown: entry, width }]);
            used = width;
        }
    }
    return rows.flatMap((row, index) => {
        const total = row.reduce((sum, { width }) => sum + width, 0) + GAP * (row.length - 1);
        let left = align === 'start' ? x : align === 'middle' ? x - total / 2 : x - total;
        return row.map(({ shown: entry, width }) => {
            const placed = { shown: entry, x: left, y: y + index * (LENS_BADGE_HEIGHT + GAP), width };
            left += width + GAP;
            return placed;
        });
    });
}
