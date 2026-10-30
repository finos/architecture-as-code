import { describe, expect, it } from 'vitest';
import { DATABASE_FILL, SERVICE_FILL, WEBCLIENT_FILL, defaultNodeColours } from './node-colours';
import { theme } from './theme-colors';
import { getNodeStyleOverride } from '../utils/standard-node-style';

describe('defaultNodeColours', () => {
    it('gives each node type the fill it is drawn with', () => {
        expect(defaultNodeColours('service', false).background).toBe(SERVICE_FILL);
        expect(defaultNodeColours('webclient', false).background).toBe(WEBCLIENT_FILL);
        expect(defaultNodeColours('database', false).background).toBe(DATABASE_FILL);
        expect(defaultNodeColours('container', false).background).toBe(theme.bg);
        expect(defaultNodeColours('system', false).background).toBe(theme.bgWidget);
        expect(defaultNodeColours('actor', false).background).toBe(theme.bgWidget);
    });

    it('uses the canvas text colour', () => {
        expect(defaultNodeColours('service', false).text).toBe(theme.text);
        expect(defaultNodeColours('container', false).text).toBe(theme.text);
    });

    it('uses the badge colours for standard nodes of the box-shaped types', () => {
        expect(defaultNodeColours('service', true)).toEqual({ background: theme.badgeBg, text: theme.badgeFg });
        expect(defaultNodeColours('system', true)).toEqual({ background: theme.badgeBg, text: theme.badgeFg });
    });

    it('ignores the standard-node flag for types that do not draw one', () => {
        expect(defaultNodeColours('database', true).background).toBe(DATABASE_FILL);
        expect(defaultNodeColours('container', true).background).toBe(theme.bg);
    });
});

describe('getNodeStyleOverride', () => {
    it('reads background and text from standard-node-style', () => {
        expect(
            getNodeStyleOverride({
                metadata: { 'standard-node-style': { background: '#1c4587', text: '#ffffff' } },
            })
        ).toEqual({ background: '#1c4587', text: '#ffffff' });
    });

    it('ignores legacy style keys', () => {
        expect(
            getNodeStyleOverride({
                metadata: {
                    'fidelity-style': { background: '#1c4587' },
                    'building-block-style': { background: '#1c4587' },
                },
            })
        ).toEqual({});
    });
});
