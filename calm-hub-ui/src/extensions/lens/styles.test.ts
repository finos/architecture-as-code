import { describe, expect, it } from 'vitest';
import type { Notation } from '../../model/lens.js';
import core from '../../../../calm-hub/src/main/resources/META-INF/calm-extensions/notations/core.json' with { type: 'json' };
import { elementStyle, readable, relationshipStyle, type ResolvedNotation } from './styles.js';

const notation = (own: Notation): ResolvedNotation => ({ own, core: core as Notation });
const square = { viewBox: [0, 0, 10, 10] as [number, number, number, number], parts: [{ rect: { x: 0, y: 0, width: 10, height: 10 } }] };

describe('elementStyle', () => {
    it('applies the styles in the order of the notation, not of the node tags', () => {
        const styles = notation({
            styles: { elements: [{ tag: 'Container', background: '#438dd5', color: '#ffffff' }, { tag: 'External', background: '#666666' }] },
        });
        expect(elementStyle(styles, ['External', 'Container'], 'light').background).toBe('#666666');
        expect(elementStyle(styles, ['Container', 'External'], 'light').background).toBe('#666666');
    });

    it('uses the dark colours of a style in the dark theme only', () => {
        const styles = notation({ styles: { elements: [{ tag: 'A', background: '#eeeeee', dark: { background: '#222222' } }] } });
        expect(elementStyle(styles, ['A'], 'light').background).toBe('#eeeeee');
        expect(elementStyle(styles, ['A'], 'dark').background).toBe('#222222');
    });

    it('replaces a text colour that cannot be read on the background', () => {
        const styles = notation({ styles: { elements: [{ tag: 'A', background: '#85bbf0', color: '#ffffff' }] } });
        expect(elementStyle(styles, ['A'], 'light').color).toBe('#000000');
    });

    it('finds a shape in the notation first, then in core, and falls back to the core box', () => {
        const styles = notation({
            shapes: { Box: square },
            styles: { elements: [{ tag: 'Own', shape: 'Box' }, { tag: 'Core', shape: 'core/Box' }, { tag: 'Missing', shape: 'Hexagon' }] },
        });
        expect(elementStyle(styles, ['Own'], 'light').shape).toBe('Box');
        expect(elementStyle(styles, ['Core'], 'light').shape).toBe('core/Box');
        expect(elementStyle(styles, ['Missing'], 'light').shape).toBe('core/Box');
    });
});

describe('relationshipStyle', () => {
    it('ends with an arrow unless a style sets another end', () => {
        const styles = notation({ styles: { relationships: [{ tag: 'Composition', end: 'diamond', start: 'dot' }] } });
        expect(relationshipStyle(styles, [], 'light')).toMatchObject({ end: 'arrow', start: undefined });
        expect(relationshipStyle(styles, ['Composition'], 'light')).toMatchObject({ end: 'diamond', start: 'dot' });
    });
});

describe('readable', () => {
    it('keeps a colour with enough contrast, and picks white on a dark background', () => {
        expect(readable('#08427b', '#ffffff')).toBe('#08427b');
        expect(readable('#1168bd', '#0f172a')).toBe('#ffffff');
    });
});
