import { describe, expect, it } from 'vitest';
import { DATABASE_FILL, SERVICE_FILL, WEBCLIENT_FILL, defaultNodeColours } from './node-colours';
import { theme } from '../../canvas/theme-colors';

describe('defaultNodeColours', () => {
    it('uses type-specific colours for supported node types', () => {
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

    it('uses badge colours for standard nodes', () => {
        expect(defaultNodeColours('service', true)).toEqual({ background: theme.badgeBg, text: theme.badgeFg });
        expect(defaultNodeColours('system', true)).toEqual({ background: theme.badgeBg, text: theme.badgeFg });
        expect(defaultNodeColours('service', true, false)).toEqual({ background: theme.badgeBg, text: theme.badgeFg });
    });

    it('falls back to core canvas colours when the feature is disabled', () => {
        expect(defaultNodeColours('service', false, false)).toEqual({ background: theme.bgWidget, text: theme.text });
        expect(defaultNodeColours('container', false, false)).toEqual({ background: theme.bg, text: theme.text });
    });

    it('ignores the standard-node flag for types that do not draw one', () => {
        expect(defaultNodeColours('database', true).background).toBe(DATABASE_FILL);
        expect(defaultNodeColours('container', true).background).toBe(theme.bg);
    });
});