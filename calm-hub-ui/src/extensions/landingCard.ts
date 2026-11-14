import { ScreenBlock, Tone } from '../model/extensions.js';

export const LANDING_CARD_MAX_STATS = 3;

type StatItem = { label: string; value: string | number };

export type CardHeadline = { kind: 'stats'; items: StatItem[] } | { kind: 'alert'; text: string; tone: Tone };

function isStatItem(item: unknown): item is StatItem {
    const value = (item as Partial<StatItem> | null)?.value;
    return typeof (item as Partial<StatItem> | null)?.label === 'string' && (typeof value === 'string' || typeof value === 'number');
}

/**
 * What a home page card shows from a landing card: the first three valid items of its first `stats` block. Without a
 * valid item, the text of its first `alert` block on one line. Other blocks show only on the extension's screen.
 */
export function cardHeadline(blocks: readonly ScreenBlock[]): CardHeadline | undefined {
    const stats = blocks.find((block) => block.type === 'stats');
    const items: unknown[] = stats && Array.isArray(stats.items) ? stats.items : [];
    const valid = items.filter(isStatItem);
    if (valid.length > 0) {
        return { kind: 'stats', items: valid.slice(0, LANDING_CARD_MAX_STATS) };
    }
    const alert = blocks.find((block) => block.type === 'alert');
    if (alert && typeof alert.text === 'string') return { kind: 'alert', text: alert.text, tone: alert.tone ?? 'info' };
    return undefined;
}
