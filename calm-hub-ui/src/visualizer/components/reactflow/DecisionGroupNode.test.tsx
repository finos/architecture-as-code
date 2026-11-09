import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReactFlowProvider, type NodeProps } from 'reactflow';
import { DecisionGroupNode } from './DecisionGroupNode.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';
import { createDiagramTextScaleStore, DIAGRAM_TEXT_SCALE_KEY } from '../../../theme/useDiagramTextScale.js';

function renderAt(stored?: string) {
    const storage = createMemoryStorage();
    if (stored) storage.setItem(DIAGRAM_TEXT_SCALE_KEY, stored);
    const props = { id: 'd', data: { decisionType: 'oneOf', prompt: 'Pick a database' } } as unknown as NodeProps;
    render(
        <ReactFlowProvider>
            <DecisionGroupNode {...props} textScaleStore={createDiagramTextScaleStore(storage)} />
        </ReactFlowProvider>
    );
}

describe('DecisionGroupNode diagram text size', () => {
    it.each([
        [undefined, '12px', '10px', '11px', '40px'],
        ['1.3', '15.6px', '13px', '14.3px', '45.4px'],
        ['1.5', '18px', '15px', '16.5px', '49px'],
        ['2', '18px', '15px', '16.5px', '49px'],
    ])('at scale %s sizes the label %s, the subtitle %s and the prompt %s at top %s', (stored, label, subtitle, prompt, top) => {
        renderAt(stored);

        expect(screen.getByText('oneOf').parentElement!.style.fontSize).toBe(label);
        expect(screen.getByText('Choose exactly one').style.fontSize).toBe(subtitle);
        expect(screen.getByText('Pick a database').style.fontSize).toBe(prompt);
        expect(screen.getByText('Pick a database').style.top).toBe(top);
    });

    it('keeps a larger prompt on one line, with the full text in its tooltip, so it stays above the options', () => {
        renderAt('1.15');

        const prompt = screen.getByText('Pick a database');
        expect(prompt.style.whiteSpace).toBe('nowrap');
        expect(prompt.style.textOverflow).toBe('ellipsis');
        expect(prompt).toHaveAttribute('title', 'Pick a database');
    });

    it('lets the prompt wrap at the default size', () => {
        renderAt();

        const prompt = screen.getByText('Pick a database');
        expect(prompt.style.whiteSpace).toBe('');
        expect(prompt).not.toHaveAttribute('title');
    });
});
