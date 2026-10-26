import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ControlEvaluationsPanel } from './ControlEvaluationsPanel.js';
import { THEME } from './theme.js';
import type { ControlEvaluationDecorator } from '../../contracts/contracts.js';

const make = (id: string, status: 'met' | 'not-met' | 'not-applicable', at: string, extra = {}): ControlEvaluationDecorator => ({
    schema: 's', uniqueId: id, type: 'control-evaluation', target: ['t'], appliesTo: ['trade-api', 'trade-api-to-client-ledger'],
    data: { control: { 'unique-id': 'client-ledger-human-approval', 'control-id': 'SDLC-PREV-001', 'requirement-url': 'https://example.org/r' }, status, 'evaluated-at': at, change: { commit: 'c0ffee1234567', spec: 'SPEC-001' }, ...extra },
});

describe('ControlEvaluationsPanel', () => {
    it('lists evaluations newest first with their status, control, elements and change', () => {
        render(<ControlEvaluationsPanel evaluations={[
            make('older', 'met', '2026-11-04T15:00:00Z', { actors: { approver: 'alice' } }),
            make('newer', 'not-met', '2026-11-04T15:05:00Z', { findings: [{ subject: 'trade-api-to-client-ledger', description: 'A human approved this change', cause: 'absent' }] }),
        ]} />);
        const rows = screen.getAllByTestId('control-evaluation-row');
        expect(rows[0].textContent).toContain('Not met');
        expect(screen.getByTestId('evaluation-finding').textContent).toBe('trade-api-to-client-ledger — Requires: A human approved this change (absent)');
        expect(rows[0].textContent).toContain('trade-api, trade-api-to-client-ledger');
        expect(rows[0].textContent).toContain('c0ffee1');
        expect(rows[0].textContent).toContain('Spec SPEC-001');
        expect(rows[1].textContent).toContain('Met');
        expect(rows[1].textContent).toContain('approved by alice');
    });

    it('shows not-applicable and unknown statuses as neutral chips with their labels', () => {
        render(<ControlEvaluationsPanel evaluations={[
            make('na', 'not-applicable', '2026-11-04T15:05:00Z'),
            make('odd', 'waived' as 'met', '2026-11-04T15:00:00Z'),
        ]} />);
        const chips = screen.getAllByTestId('control-evaluation-chip');
        expect(chips.map((chip) => chip.textContent)).toEqual(['Not applicable', 'waived']);
        for (const chip of chips) {
            expect(chip.style.backgroundColor).toBe(THEME.colors.backgroundSecondary);
            expect(chip.style.color).toBe(THEME.colors.muted);
        }
    });

    it('colours met and not-met chips with the status text colours', () => {
        render(<ControlEvaluationsPanel evaluations={[
            make('newer', 'not-met', '2026-11-04T15:05:00Z'),
            make('older', 'met', '2026-11-04T15:00:00Z'),
        ]} />);
        const [notMet, met] = screen.getAllByTestId('control-evaluation-chip');
        expect(notMet.style.color).toBe(THEME.colors.errorText);
        expect(met.style.color).toBe(THEME.colors.successText);
    });

    it('says when there are none', () => {
        render(<ControlEvaluationsPanel evaluations={[]} />);
        expect(screen.getByText(/No control evaluations/)).toBeTruthy();
    });
});
