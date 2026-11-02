import { describe, expect, it } from 'vitest';
import { DATABASE_FILL, SERVICE_FILL, WEBCLIENT_FILL, defaultNodeColours } from './node-colours';
import { theme } from './theme-colors';
import { getNodeStyleOverride } from '../utils/standard-node-style';

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
