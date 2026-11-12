import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StandardsControlsPaletteView } from './StandardsControlsPaletteSurface';

describe('StandardsControlsPaletteSurface', () => {
    it('renders feature-owned local and Hub assets', () => {
        const html = renderToStaticMarkup(
            <StandardsControlsPaletteView
                standardNodes={[
                { id: 'local', name: 'Service', behaviour: 'create-node', nodeType: 'service' },
                { id: 'remote', name: 'Gateway', behaviour: 'create-node', nodeType: 'service', namespace: 'fae-calm' },
                ]}
                hubLoading={false}
                searchQuery=""
            />,
        );

        expect(html).toContain('NODES (1)');
        expect(html).toContain('Fae Calm — Standard Nodes (1)');
        expect(html).toContain('Gateway');
    });

    it('shows Hub loading inside the feature palette', () => {
        const html = renderToStaticMarkup(
            <StandardsControlsPaletteView standardNodes={[]} hubLoading searchQuery="" />,
        );

        expect(html).toContain('Loading Standard Nodes from Hub...');
        expect(html).not.toContain('No workspace or Hub standard nodes found.');
    });

    it('guides users when the workspace and Hub have no node assets', () => {
        const html = renderToStaticMarkup(
            <StandardsControlsPaletteView standardNodes={[]} hubLoading={false} searchQuery="" />,
        );

        expect(html).toContain('No workspace or Hub standard nodes found.');
        expect(html).toContain('standard-nodes/');
        expect(html).toContain('.calm.json');
    });

    it('does not show the empty state while searching', () => {
        const html = renderToStaticMarkup(
            <StandardsControlsPaletteView standardNodes={[]} hubLoading={false} searchQuery="missing" />,
        );

        expect(html).not.toContain('No workspace or Hub standard nodes found.');
    });
});