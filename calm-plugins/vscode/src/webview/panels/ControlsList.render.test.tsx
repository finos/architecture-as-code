import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ControlsList } from './ControlsList';
import type { ControlEntry } from './control-metadata';

const controls: Record<string, ControlEntry> = {
    'rate-limit': {
        description: 'Limit request rate',
        requirements: [{ 'requirement-url': './controls/rate-limit.json' }],
        metadata: {
            validation: {
                identity: { controlId: 'rate-limit', name: 'Rate Limit', description: '' },
                properties: { 'max-rps': { type: 'integer', required: true } },
            },
        },
    },
};

const render = (expandControl: string | null) =>
    renderToStaticMarkup(<ControlsList controls={controls} onUpdate={() => {}} expandControl={expandControl} />);

describe('ControlsList', () => {
    it('is collapsed when no control is requested', () => {
        const html = render(null);
        expect(html).not.toContain('Rate Limit');
        expect(html).not.toContain('max-rps');
    });

    it('expands the section and the requested control', () => {
        const html = render('rate-limit');
        expect(html).toContain('Rate Limit');
        expect(html).toContain('max-rps');
        expect(html).toContain('type="number"');
    });

    it('expands the section but no control when the requested key is unknown', () => {
        const html = render('missing');
        expect(html).toContain('Rate Limit');
        expect(html).not.toContain('max-rps');
    });
});
