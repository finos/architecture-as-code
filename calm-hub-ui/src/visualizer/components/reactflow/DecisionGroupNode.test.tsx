import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReactFlowProvider, type NodeProps } from 'reactflow';
import { DecisionGroupNode } from './DecisionGroupNode.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';
import { createDiagramTextScaleStore, DIAGRAM_TEXT_SCALE_KEY } from '../../../theme/useDiagramTextScale.js';

describe('DecisionGroupNode diagram text size', () => {
    it('scales the label, the subtitle and the prompt', () => {
        const storage = createMemoryStorage();
        storage.setItem(DIAGRAM_TEXT_SCALE_KEY, '1.5');
        const props = { id: 'd', data: { decisionType: 'oneOf', prompt: 'Pick a database' } } as unknown as NodeProps;
        render(
            <ReactFlowProvider>
                <DecisionGroupNode {...props} textScaleStore={createDiagramTextScaleStore(storage)} />
            </ReactFlowProvider>
        );

        expect(screen.getByText('oneOf').parentElement!.style.fontSize).toBe('18px');
        expect(screen.getByText('Choose exactly one').style.fontSize).toBe('15px');
        expect(screen.getByText('Pick a database').style.fontSize).toBe('16.5px');
    });
});
