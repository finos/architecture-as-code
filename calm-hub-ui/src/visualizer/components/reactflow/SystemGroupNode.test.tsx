import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { NodeProps } from 'reactflow';
import { SystemGroupNode } from './SystemGroupNode.js';
import { THEME } from './theme.js';
import { ControlEvaluationContext } from '../../context/ControlEvaluationContext.js';
import { DecisionOverlayContext } from '../../context/DecisionOverlayContext.js';
import type { ElementEvaluation } from '../../contracts/contracts.js';

vi.mock('reactflow', () => ({
    Handle: () => null,
    Position: { Left: 'left', Right: 'right' },
}));

const evaluation = (status: 'met' | 'not-met'): ElementEvaluation => ({
    status,
    latest: [{
        schema: 's', uniqueId: 'eval-1', type: 'control-evaluation', target: ['t'], appliesTo: ['cluster'],
        data: { control: { 'unique-id': 'residency', 'requirement-url': 'https://example.org/r' }, status, 'evaluated-at': '2026-11-04T15:00:00Z' },
    }],
});

// The dashed border's colour is a CSS variable, which jsdom cannot parse in the shorthand, so it is read from the
// style attribute.
const borderOf = (box: HTMLElement) => box.getAttribute('style') ?? '';

// jsdom reads a colour back in its normalised form, such as rgb(...), not as it was set.
const css = (colour: string) => {
    const el = document.createElement('div');
    el.style.borderColor = colour;
    return el.style.borderColor;
};

function renderGroup(map: Map<string, ElementEvaluation>, showDecisions = false) {
    const props = { id: 'cluster', data: { label: 'Cluster', 'unique-id': 'cluster' } } as unknown as NodeProps;
    const { container } = render(
        <DecisionOverlayContext.Provider value={{ showDecisions, subjectLabels: new Map() }}>
            <ControlEvaluationContext.Provider value={map}>
                <SystemGroupNode {...props} />
            </ControlEvaluationContext.Provider>
        </DecisionOverlayContext.Provider>
    );
    return container.firstElementChild as HTMLElement;
}

describe('SystemGroupNode control evaluations', () => {
    it('shows no badge and keeps the dashed border without an evaluation', () => {
        const box = renderGroup(new Map());
        expect(screen.queryByTestId('control-evaluation-badge')).toBeNull();
        expect(borderOf(box)).toContain('2px dashed');
    });

    it('draws a not-met container with a solid red border and a Not met badge', () => {
        const box = renderGroup(new Map([['cluster', evaluation('not-met')]]));
        expect(box.style.borderStyle).toBe('solid');
        expect(box.style.borderColor).toBe(css(THEME.colors.error));
        expect(screen.getByTestId('control-evaluation-badge').textContent).toBe('Not met');
    });

    it('gives a met container a Met badge and keeps its dashed border', () => {
        const box = renderGroup(new Map([['cluster', evaluation('met')]]));
        expect(screen.getByTestId('control-evaluation-badge').textContent).toBe('Met');
        expect(borderOf(box)).toContain('2px dashed');
    });
});

describe('SystemGroupNode decision overlay', () => {
    it('shows no callout while the overlay is off', () => {
        renderGroup(new Map([['cluster', evaluation('not-met')]]));
        expect(screen.queryByTestId('decision-callout')).toBeNull();
    });

    it('hangs a Blocked callout below a not-met container while the overlay is on', () => {
        renderGroup(new Map([['cluster', evaluation('not-met')]]), true);
        const callout = screen.getByTestId('decision-callout');
        expect(callout.dataset.outcome).toBe('blocked');
        expect(callout.textContent).toContain('residency');
        expect((callout.parentElement as HTMLElement).style.top).toBe('100%');
    });
});
