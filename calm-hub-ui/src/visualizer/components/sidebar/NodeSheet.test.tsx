import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';
import { NodeSheet } from './NodeSheet.js';

const nodeData = {
    'unique-id': 'svc-1',
    name: 'Trade Service',
    'node-type': 'service',
    description: 'Handles trades',
    // An extra (non-known) field surfaces in the PROPERTIES block.
    owner: 'platform-team',
} as unknown as CalmNodeSchema;

const relationshipData = {
    'unique-id': 'rel-1',
    description: 'Service A connects to B',
    'relationship-type': {
        connects: { source: { node: 'a' }, destination: { node: 'b' } },
    },
} as unknown as CalmRelationshipSchema;

describe('NodeSheet', () => {
    it('renders the node type badge, title, mono id and description', () => {
        render(<NodeSheet selectedData={nodeData} closeSheet={vi.fn()} />);
        expect(screen.getByText('service')).toBeInTheDocument();
        expect(screen.getByText('Trade Service')).toBeInTheDocument();
        expect(screen.getByText('svc-1')).toBeInTheDocument();
        expect(screen.getByText('Handles trades')).toBeInTheDocument();
    });

    it('renders a PROPERTIES block of label/value rows from extra fields', () => {
        render(<NodeSheet selectedData={nodeData} closeSheet={vi.fn()} />);
        expect(screen.getByText('Properties')).toBeInTheDocument();
        expect(screen.getByText('Owner')).toBeInTheDocument();
        expect(screen.getByText('platform-team')).toBeInTheDocument();
    });

    it('closes via the close button', () => {
        const closeSheet = vi.fn();
        render(<NodeSheet selectedData={nodeData} closeSheet={closeSheet} />);
        fireEvent.click(screen.getByRole('button', { name: /close-sidebar/i }));
        expect(closeSheet).toHaveBeenCalledTimes(1);
    });

    it('closes when the backdrop is tapped (diagram peeks above)', () => {
        const closeSheet = vi.fn();
        render(<NodeSheet selectedData={nodeData} closeSheet={closeSheet} />);
        fireEvent.click(screen.getByRole('button', { name: /close node details/i }));
        expect(closeSheet).toHaveBeenCalledTimes(1);
    });

    describe('steppers (Frame G)', () => {
        it('wires prev/next when handlers are provided', () => {
            const onPrev = vi.fn();
            const onNext = vi.fn();
            render(
                <NodeSheet selectedData={nodeData} closeSheet={vi.fn()} onPrev={onPrev} onNext={onNext} />
            );

            const prev = screen.getByRole('button', { name: /previous node/i });
            const next = screen.getByRole('button', { name: /next node/i });
            expect(prev).not.toBeDisabled();
            expect(next).not.toBeDisabled();

            fireEvent.click(prev);
            fireEvent.click(next);
            expect(onPrev).toHaveBeenCalledTimes(1);
            expect(onNext).toHaveBeenCalledTimes(1);
        });

        it('disables a stepper when its handler is absent (ends of the list)', () => {
            render(<NodeSheet selectedData={nodeData} closeSheet={vi.fn()} onNext={vi.fn()} />);
            expect(screen.getByRole('button', { name: /previous node/i })).toBeDisabled();
            expect(screen.getByRole('button', { name: /next node/i })).not.toBeDisabled();
        });
    });

    it('renders relationship details (and no steppers) for an edge selection', () => {
        render(<NodeSheet selectedData={relationshipData} closeSheet={vi.fn()} onPrev={vi.fn()} onNext={vi.fn()} />);
        // The relationship description renders, and the node-only steppers are absent.
        expect(screen.getByText('Service A connects to B')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /previous node/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /next node/i })).not.toBeInTheDocument();
    });
});
