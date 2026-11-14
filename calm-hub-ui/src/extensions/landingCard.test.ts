import { describe, expect, it } from 'vitest';
import { cardHeadline } from './landingCard.js';

describe('landing card headline', () => {
    it('shows the first three items of the first stats block', () => {
        const items = [1, 2, 3, 4].map((n) => ({ label: `L${n}`, value: n }));
        expect(
            cardHeadline([
                { type: 'alert', text: 'ignored' },
                { type: 'stats', items },
                { type: 'stats', items: [{ label: 'other', value: 9 }] },
            ])
        ).toEqual({ kind: 'stats', items: items.slice(0, 3) });
    });

    it('falls back to the first alert as one line', () => {
        expect(cardHeadline([{ type: 'cards', items: [] }, { type: 'alert', tone: 'warning', text: 'Rolling out' }])).toEqual({
            kind: 'alert',
            text: 'Rolling out',
            tone: 'warning',
        });
        expect(cardHeadline([{ type: 'alert', text: 'No tone' }])).toMatchObject({ tone: 'info' });
    });

    it('shows nothing for other blocks or an empty stats block', () => {
        expect(cardHeadline([{ type: 'stats', items: [] }, { type: 'markdown', text: '#' }])).toBeUndefined();
    });

    it('keeps only items with a string label and a string or number value', () => {
        const items = [null, 'text', { label: 'x', value: { n: 1 } }, { label: 2, value: 1 }, { value: 1 }, { label: 'ok', value: 'yes' }];
        expect(cardHeadline([{ type: 'stats', items } as never])).toEqual({ kind: 'stats', items: [{ label: 'ok', value: 'yes' }] });
    });

    it('falls back to the alert when no stats item is valid', () => {
        expect(cardHeadline([{ type: 'stats', items: [null] } as never, { type: 'alert', text: 'Rolling out' }])).toMatchObject({
            kind: 'alert',
        });
        expect(cardHeadline([{ type: 'stats', items: [{ label: 'x', value: { n: 1 } }] } as never])).toBeUndefined();
    });
});
