import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FlowSequenceDiagram } from './FlowSequenceDiagram';
import type { CalmFlow } from '../../core/types';

const architecture = {
    nodes: [
        { 'unique-id': 'ui', name: 'UI' },
        { 'unique-id': 'api', name: 'API', metadata: { 'standard-node-style': { background: '#123456', text: '#ffffff' } } },
    ],
    relationships: [{ 'unique-id': 'request', 'relationship-type': { connects: { source: { node: 'ui' }, destination: { node: 'api' } } } }],
};

describe('FlowSequenceDiagram', () => {
    it('renders participants using current standard-node appearance', () => {
        const html = renderToStaticMarkup(<FlowSequenceDiagram architecture={architecture} flow={{
            'unique-id': 'checkout', name: 'Checkout', description: '',
            transitions: [{ 'relationship-unique-id': 'request', 'sequence-number': 1, description: 'Call' }],
        }} />);
        expect(html).toContain('data-sequence-svg');
        expect(html).toContain('#123456');
        expect(html).toContain('UI');
        expect(html).toContain('API');
        expect(html).toContain('Call');
    });

    it('shows the empty transition state', () => {
        const html = renderToStaticMarkup(<FlowSequenceDiagram architecture={architecture} flow={{
            'unique-id': 'empty', name: 'Empty', description: '', transitions: [],
        }} />);
        expect(html).toContain('No transitions to display');
        expect(html).not.toContain('data-sequence-svg');
    });

    const playbackFlow: CalmFlow = {
        'unique-id': 'checkout', name: 'Checkout', description: '',
        transitions: [
            { 'relationship-unique-id': 'request', 'sequence-number': 2, description: 'Call' },
            { 'relationship-unique-id': 'request', 'sequence-number': 4, description: 'Return', direction: 'destination-to-source' },
            { 'relationship-unique-id': 'request', 'sequence-number': 4, description: 'Parallel call' },
            { 'relationship-unique-id': 'request', 'sequence-number': 6, description: 'Later call' },
        ],
    };

    it('highlights parallel transitions and dims completed and future messages', () => {
        const html = renderToStaticMarkup(<FlowSequenceDiagram architecture={architecture} flow={playbackFlow} currentStep={2} />);
        expect(html.match(/<circle r="4"/g)).toHaveLength(2);
        expect(html.match(/stroke-width="3"/g)).toHaveLength(2);
        expect(html).toContain('opacity:0.5');
        expect(html).toContain('opacity:0.12');
        expect(html).not.toContain('stroke-dasharray="6,3"');
    });

    it('orients the active return arrow from destination to source', () => {
        const html = renderToStaticMarkup(<FlowSequenceDiagram architecture={architecture} flow={playbackFlow} currentStep={2} />);
        expect(html).toContain('x1="350" y1="136" x2="140"');
        expect(html).toContain('attributeName="cx" from="350" to="140"');
    });

    it('uses the per-transition color for arrowheads in the all-flows overview', () => {
        const html = renderToStaticMarkup(<FlowSequenceDiagram architecture={architecture} flow={playbackFlow} transitionColors={new Map([['request', '#123abc']])} />);
        expect(html).toContain('<polygon points="0 0,10 3.5,0 7" fill="#123abc"');
        expect(html).not.toContain('id="seq-arrow-fwd"');
    });

    it('keeps marker IDs unique across diagram instances', () => {
        const html = renderToStaticMarkup(<>
            <FlowSequenceDiagram architecture={architecture} flow={playbackFlow} />
            <FlowSequenceDiagram architecture={architecture} flow={playbackFlow} />
        </>);
        const ids = [...html.matchAll(/<marker id="([^"]+)"/g)].map(match => match[1]);
        expect(ids).toHaveLength(8);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
