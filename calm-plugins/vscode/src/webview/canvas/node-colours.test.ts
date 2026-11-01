import { describe, expect, it } from 'vitest';
import { DATABASE_FILL, SERVICE_FILL, WEBCLIENT_FILL, defaultNodeColours } from './node-colours';
import { theme } from './theme-colors';

describe('defaultNodeColours', () => {
    it('gives each node type the fill it is drawn with', () => {
        expect(defaultNodeColours('service').background).toBe(SERVICE_FILL);
        expect(defaultNodeColours('webclient').background).toBe(WEBCLIENT_FILL);
        expect(defaultNodeColours('database').background).toBe(DATABASE_FILL);
        expect(defaultNodeColours('container').background).toBe(theme.bg);
        expect(defaultNodeColours('system').background).toBe(theme.bgWidget);
        expect(defaultNodeColours('actor').background).toBe(theme.bgWidget);
    });

    it('uses the canvas text colour', () => {
        expect(defaultNodeColours('service').text).toBe(theme.text);
        expect(defaultNodeColours('container').text).toBe(theme.text);
    });
});
