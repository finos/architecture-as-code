import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NodePalette } from './NodePalette';

beforeEach(() => vi.stubGlobal('window', {}));
afterEach(() => vi.unstubAllGlobals());

describe('NodePalette core content', () => {
    it('renders core containers and packs without asset-specific sections', () => {
        const html = renderToStaticMarkup(<NodePalette />);
        expect(html).toContain('COMPONENTS');
        expect(html).toContain('CONTAINERS');
        expect(html).not.toContain('Standard Nodes');
        expect(html).not.toContain('Loading Standard Nodes');
    });
});
