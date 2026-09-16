/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlowCommentary } from './FlowCommentary.js';
import { CalmCore } from '@finos/calm-models/model';
import type { Architecture } from '@finos/calm-models/model';
import type { CalmFlowTransitionSchema } from '@finos/calm-models/types';

// jsdom does not implement scrollIntoView
beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
});

const transitions: CalmFlowTransitionSchema[] = [
    { 'relationship-unique-id': 'gateway-to-engine', 'sequence-number': 1, description: 'Submit request' },
    { 'relationship-unique-id': 'engine-to-db', 'sequence-number': 2, description: 'Persist state' },
    { 'relationship-unique-id': 'worker-a-to-engine', 'sequence-number': 3, description: 'Task A' },
    { 'relationship-unique-id': 'worker-b-to-engine', 'sequence-number': 3, description: 'Task B' },
];

const architecture: Architecture = CalmCore.fromSchema({
    nodes: [
        { 'unique-id': 'gateway', 'node-type': 'service', name: 'Gateway', description: '' },
        { 'unique-id': 'engine', 'node-type': 'service', name: 'Engine', description: '' },
        { 'unique-id': 'db', 'node-type': 'database', name: 'Database', description: '' },
        { 'unique-id': 'worker-a', 'node-type': 'service', name: 'Worker A', description: '' },
        { 'unique-id': 'worker-b', 'node-type': 'service', name: 'Worker B', description: '' },
    ],
    relationships: [
        { 'unique-id': 'gateway-to-engine', 'relationship-type': { connects: { source: { node: 'gateway' }, destination: { node: 'engine' } } } },
        { 'unique-id': 'engine-to-db', 'relationship-type': { connects: { source: { node: 'engine' }, destination: { node: 'db' } } } },
        { 'unique-id': 'worker-a-to-engine', 'relationship-type': { connects: { source: { node: 'worker-a' }, destination: { node: 'engine' } } } },
        { 'unique-id': 'worker-b-to-engine', 'relationship-type': { connects: { source: { node: 'worker-b' }, destination: { node: 'engine' } } } },
    ],
});

describe('FlowCommentary', () => {
    it('shows "Press Play to begin" when idle', () => {
        render(<FlowCommentary transitions={transitions} architecture={architecture} currentStep={-1} />);
        expect(screen.getByText('Press Play to begin')).toBeDefined();
    });

    it('renders step counter for an active step', () => {
        render(<FlowCommentary transitions={transitions} architecture={architecture} currentStep={0} />);
        expect(screen.getByText('Step 1 of 3')).toBeDefined();
    });

    it('shows "Complete" when past last step', () => {
        render(<FlowCommentary transitions={transitions} architecture={architecture} currentStep={3} />);
        expect(screen.getByText('Complete - 3 steps')).toBeDefined();
    });

    it('groups parallel transitions and shows parallel badge', () => {
        render(<FlowCommentary transitions={transitions} architecture={architecture} currentStep={2} />);
        const parallelBadges = screen.getAllByText('parallel');
        expect(parallelBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('calls onStepSelect when a step is clicked', () => {
        const onSelect = vi.fn();
        const { container } = render(<FlowCommentary transitions={transitions} architecture={architecture} currentStep={-1} onStepSelect={onSelect} />);

        const rows = container.querySelectorAll('.cursor-pointer');
        fireEvent.click(rows[1]); // index 1 = sequence 2
        expect(onSelect).toHaveBeenCalledWith(1);
    });

    it('renders "Flow complete" indicator when completed', () => {
        render(<FlowCommentary transitions={transitions} architecture={architecture} currentStep={3} />);
        const completeElements = screen.getAllByText('Flow complete');
        expect(completeElements.length).toBeGreaterThanOrEqual(1);
    });

    it('always renders the "Flow complete" row, even when idle', () => {
        // It is greyed until reached, but always present so the flow's end is
        // visible and selectable like any other step.
        render(<FlowCommentary transitions={transitions} architecture={architecture} currentStep={-1} />);
        expect(screen.getByText('Flow complete')).toBeInTheDocument();
    });

    it('selects the completed sentinel when the "Flow complete" row is clicked', () => {
        const onSelect = vi.fn();
        render(<FlowCommentary transitions={transitions} architecture={architecture} currentStep={-1} onStepSelect={onSelect} />);
        fireEvent.click(screen.getByText('Flow complete'));
        // total === the number of step groups (3): the completed-sentinel index.
        expect(onSelect).toHaveBeenCalledWith(3);
    });
});
