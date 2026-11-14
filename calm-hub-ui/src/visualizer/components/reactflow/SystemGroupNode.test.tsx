import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { NodeProps } from '@xyflow/react';
import { SystemGroupNode } from './SystemGroupNode.js';
import { THEME } from './theme.js';
import { EvaluationOverlayProvider } from '../../../test-support/evaluation-overlay.js';
import { DecisionOverlayContext } from '../../context/DecisionOverlayContext.js';
import type { ElementEvaluation } from '../../contracts/contracts.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';
import { createDiagramTextScaleStore, DIAGRAM_TEXT_SCALE_KEY } from '../../../theme/useDiagramTextScale.js';
import { createPresentationModeStore } from '../../../theme/usePresentationMode.js';

vi.mock('@xyflow/react', () => ({
    Handle: () => null,
    Position: { Left: 'left', Right: 'right' },
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useStore: (selector: (store: { nodeLookup: Map<string, object> }) => unknown) => selector({
        nodeLookup: new Map([['cluster', { id: 'cluster', measured: { width: 600, height: 400 }, internals: { positionAbsolute: { x: 40, y: 50 } } }]]),
    }),
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
        <DecisionOverlayContext.Provider value={{ showDecisions, subjectLabels: new Map(), calloutSizes: new Map(), reportCalloutSize: () => {} }}>
            <EvaluationOverlayProvider value={map}>
                <SystemGroupNode {...props} />
            </EvaluationOverlayProvider>
        </DecisionOverlayContext.Provider>
    );
    return container.firstElementChild as HTMLElement;
}

describe('SystemGroupNode control evaluations', () => {
    it('shows no badge and keeps the dashed border without an evaluation', () => {
        const box = renderGroup(new Map());
        expect(screen.queryByTestId('overlay-badge')).toBeNull();
        expect(borderOf(box)).toContain('2px dashed');
    });

    it('draws a not-met container with a solid red border and a Not met badge', () => {
        const box = renderGroup(new Map([['cluster', evaluation('not-met')]]));
        expect(box.style.borderStyle).toBe('solid');
        expect(box.style.borderColor).toBe(css(THEME.colors.error));
        expect(screen.getByTestId('overlay-badge').textContent).toBe('Not met');
    });

    it('gives a met container a Met badge and keeps its dashed border', () => {
        const box = renderGroup(new Map([['cluster', evaluation('met')]]));
        expect(screen.getByTestId('overlay-badge').textContent).toBe('Met');
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
        expect(callout.style.transform).toBe('translate(40px, 456px)');
        expect(callout.style.width).toBe('220px');
    });
});

describe('SystemGroupNode diagram text size', () => {
    function renderSized(stored: string | undefined, presenting = false, evaluations = new Map<string, ElementEvaluation>()) {
        const storage = createMemoryStorage();
        if (stored) storage.setItem(DIAGRAM_TEXT_SCALE_KEY, stored);
        const presentationStore = createPresentationModeStore(createMemoryStorage());
        presentationStore.set(presenting);
        const props = { id: 'cluster', data: { label: 'Cluster', 'unique-id': 'cluster' } } as unknown as NodeProps;
        render(
            <EvaluationOverlayProvider value={evaluations}>
                <SystemGroupNode
                    {...props}
                    textScaleStore={createDiagramTextScaleStore(storage)}
                    presentationStore={presentationStore}
                />
            </EvaluationOverlayProvider>
        );
    }

    it.each([
        ['1.5', false, '18px'],
        ['2', false, '24px'],
        ['1.5', true, '33px'],
        // Above 1.5x the presentation label does not fit above the children, which start 80px down.
        ['2', true, '33px'],
    ])('at scale %s, presenting %s, sizes the label %s', (stored, presenting, fontSize) => {
        renderSized(stored, presenting);
        expect(screen.getByText('Cluster').parentElement!.style.fontSize).toBe(fontSize);
    });

    it('sizes the badge with the label', () => {
        renderSized('2', true, new Map([['cluster', evaluation('not-met')]]));
        expect(screen.getByTestId('overlay-badge').style.fontSize).toBe('27px');
    });

    it('keeps a larger label on one line, with the full name in its tooltip, so it stays above the children', () => {
        renderSized('1.15');
        const label = screen.getByText('Cluster');
        expect(label.style.whiteSpace).toBe('nowrap');
        expect(label.style.textOverflow).toBe('ellipsis');
        expect(label).toHaveAttribute('title', 'Cluster');
        expect(label.parentElement!.style.maxWidth).toBe('calc(100% - 32px)');
    });

    it('lets the label wrap at the default size', () => {
        renderSized(undefined);
        const label = screen.getByText('Cluster');
        expect(label.style.whiteSpace).toBe('');
        expect(label).not.toHaveAttribute('title');
        expect(label.parentElement!.style.maxWidth).toBe('');
    });
});
