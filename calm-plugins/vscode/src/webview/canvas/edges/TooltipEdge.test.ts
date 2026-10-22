import { describe, expect, it } from 'vitest';
import { edgeStroke } from './TooltipEdge';
import { theme } from '../theme-colors';

describe('edgeStroke', () => {
    it('uses the muted theme colour when the edge style has no stroke', () => {
        expect(edgeStroke(false)).toBe(theme.fgMuted);
        expect(edgeStroke(false, { strokeWidth: 1.5 })).toBe(theme.fgMuted);
    });

    it('keeps a stroke set in the edge style', () => {
        expect(edgeStroke(false, { stroke: '#ff0000' })).toBe('#ff0000');
    });

    it('uses the link colour on hover, also over an edge style stroke', () => {
        expect(edgeStroke(true)).toBe(theme.link);
        expect(edgeStroke(true, { stroke: '#ff0000' })).toBe(theme.link);
    });
});
