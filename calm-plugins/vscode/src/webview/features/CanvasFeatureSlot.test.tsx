import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CanvasFeatureSlot } from './CanvasFeatureSlot';
import type { CanvasFeatureDefinition, CanvasFeatureRuntime } from './types';

const runtime = {} as CanvasFeatureRuntime;

describe('CanvasFeatureSlot', () => {
    it('composes enabled canvas wrappers around the core canvas', () => {
        const definitions: CanvasFeatureDefinition[] = [
            {
                id: 'wrapper-one',
                surfaces: {
                    canvas: ({ children }) => <section data-feature="one">{children}</section>,
                },
            },
            {
                id: 'wrapper-two',
                surfaces: {
                    canvas: ({ children }) => <div data-feature="two">{children}</div>,
                },
            },
        ];

        const html = renderToStaticMarkup(
            <CanvasFeatureSlot
                slot="canvas"
                definitions={definitions}
                enabledFeatures={new Set(['wrapper-two'])}
                runtime={runtime}
            >
                <main data-core-canvas="" />
            </CanvasFeatureSlot>,
        );

        expect(html).toContain('<div data-feature="two"><main data-core-canvas=""></main></div>');
        expect(html).not.toContain('data-feature="one"');
    });

    it('renders independent non-canvas surfaces only for enabled features', () => {
        const definitions: CanvasFeatureDefinition[] = [
            {
                id: 'enabled',
                surfaces: { overlay: () => <aside data-feature="enabled" /> },
            },
            {
                id: 'disabled',
                surfaces: { overlay: () => <aside data-feature="disabled" /> },
            },
        ];

        const html = renderToStaticMarkup(
            <CanvasFeatureSlot
                slot="overlay"
                definitions={definitions}
                enabledFeatures={new Set(['enabled'])}
                runtime={runtime}
            />,
        );

        expect(html).toContain('data-feature="enabled"');
        expect(html).not.toContain('data-feature="disabled"');
    });

    it('renders the core child when no optional feature modules are present', () => {
        const html = renderToStaticMarkup(
            <CanvasFeatureSlot slot="canvas" definitions={[]} enabledFeatures={new Set()} runtime={runtime}>
                <main data-core-canvas="" />
            </CanvasFeatureSlot>,
        );

        expect(html).toContain('<main data-core-canvas=""></main>');
    });
});