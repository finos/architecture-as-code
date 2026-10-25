import { describe, it, expect } from 'vitest';
import { decisionSummary, subjectLabelsFor } from './decisionSummary.js';
import type { ControlEvaluationDecorator, ControlEvaluationDecoratorData, ElementEvaluation } from '../../../contracts/contracts.js';

const d = (control: string, status: 'met' | 'not-met', extra: Partial<ControlEvaluationDecoratorData> = {}): ControlEvaluationDecorator => ({
    schema: 's',
    uniqueId: `eval-${control}`,
    type: 'control-evaluation',
    target: ['t'],
    appliesTo: ['trade-api'],
    data: { control: { 'unique-id': control, 'requirement-url': 'https://example.org/r' }, status, 'evaluated-at': '2026-11-04T15:00:00Z', ...extra },
});

const evaluation = (...latest: ControlEvaluationDecorator[]): ElementEvaluation => ({
    status: latest.some((x) => x.data.status === 'not-met') ? 'not-met' : 'met',
    latest,
});

const humanApproval = (subject: string) => ({ findings: [{ subject, description: 'A human approved this change', cause: 'absent' }] });

describe('decisionSummary', () => {
    it('blocks on a not-met evaluation and gives its first finding as the requirement', () => {
        const summary = decisionSummary(
            evaluation(d('client-ledger-human-approval', 'not-met', {
                findings: [
                    { subject: 'trade-api', description: 'A human approved this change' },
                    { subject: 'trade-api', description: 'The approval is for this exact diff' },
                ],
            })),
            { elementId: 'trade-api' },
        );
        expect(summary).toEqual({
            outcome: 'blocked',
            controls: [{ controlKey: 'client-ledger-human-approval', requirement: 'A human approved this change', subject: undefined }],
            more: 0,
        });
    });

    it('blocks when one control is not met even though others are met and approved', () => {
        const summary = decisionSummary(evaluation(
            d('sdlc-prev-004', 'met', { actors: { approver: 'alice' } }),
            d('client-ledger-human-approval', 'not-met', humanApproval('trade-api')),
            d('sdlc-prev-017', 'met'),
        ));
        expect(summary.outcome).toBe('blocked');
        expect(summary.outcome === 'blocked' && summary.controls.map((c) => c.controlKey)).toEqual(['client-ledger-human-approval']);
    });

    it('lists two not-met controls and counts the rest as more', () => {
        const summary = decisionSummary(evaluation(
            d('a', 'not-met'), d('b', 'not-met'), d('c', 'not-met'), d('e', 'not-met'), d('m', 'met'),
        ));
        expect(summary.outcome === 'blocked' && summary.controls.map((c) => c.controlKey)).toEqual(['a', 'b']);
        expect(summary.outcome === 'blocked' && summary.more).toBe(2);
    });

    it('names the subject of a finding about another element, by its display name when known', () => {
        const labels = new Map([['trade-api-to-client-ledger', 'Trade API → Client Ledger']]);
        const named = decisionSummary(evaluation(d('x', 'not-met', humanApproval('trade-api-to-client-ledger'))), {
            elementId: 'trade-api',
            subjectLabel: (id) => labels.get(id),
        });
        expect(named.outcome === 'blocked' && named.controls[0].subject).toBe('Trade API → Client Ledger');

        const nodes = new Map([['trade-api', 'Trade API'], ['client-ledger', 'Client Ledger']]);
        const connection = decisionSummary(evaluation(d('x', 'not-met', humanApproval('trade-api->client-ledger'))), {
            elementId: 'trade-api',
            subjectLabel: (id) => nodes.get(id),
        });
        expect(connection.outcome === 'blocked' && connection.controls[0].subject).toBe('Trade API → Client Ledger');

        const unknownEnd = decisionSummary(evaluation(d('x', 'not-met', humanApproval('trade-api->mystery'))), {
            elementId: 'trade-api',
            subjectLabel: (id) => nodes.get(id),
        });
        expect(unknownEnd.outcome === 'blocked' && unknownEnd.controls[0].subject).toBe('trade-api->mystery');

        const raw = decisionSummary(evaluation(d('x', 'not-met', humanApproval('architecture/a.json'))), { elementId: 'trade-api' });
        expect(raw.outcome === 'blocked' && raw.controls[0].subject).toBe('architecture/a.json');
    });

    it('leaves out the requirement of a not-met evaluation with no findings', () => {
        const summary = decisionSummary(evaluation(d('x', 'not-met')));
        expect(summary.outcome === 'blocked' && summary.controls[0]).toEqual({ controlKey: 'x', requirement: undefined, subject: undefined });
    });

    it('is approved by the approver of a met evaluation, with its control and short commit', () => {
        const summary = decisionSummary(evaluation(
            d('sdlc-prev-001', 'met', { actors: { reviewer: 'review-bot' } }),
            d('client-ledger-human-approval', 'met', {
                actors: { reviewer: 'review-bot', approver: 'alice' },
                change: { commit: '07009cb5f2c80af21ea569baf2049b216eee2692' },
            }),
        ));
        expect(summary).toEqual({ outcome: 'approved', approver: 'alice', controlKey: 'client-ledger-human-approval', commit: '07009cb' });
    });

    it('is approved without a commit when the change names none', () => {
        const summary = decisionSummary(evaluation(d('x', 'met', { actors: { approver: 'alice' } })));
        expect(summary).toEqual({ outcome: 'approved', approver: 'alice', controlKey: 'x', commit: undefined });
    });

    it('is met, reviewed by the reviewer, when no evaluation names an approver', () => {
        expect(decisionSummary(evaluation(d('x', 'met', { actors: { author: 'agent', reviewer: 'review-bot' } }))))
            .toEqual({ outcome: 'met', reviewer: 'review-bot' });
    });

    it('is just met with no actors', () => {
        expect(decisionSummary(evaluation(d('x', 'met')))).toEqual({ outcome: 'met' });
    });
});

describe('subjectLabelsFor', () => {
    it('names nodes by label and relationships by their nodes\' labels', () => {
        const labels = subjectLabelsFor(
            [{ id: 'trade-api', data: { label: 'Trade API' } }, { id: 'client-ledger', data: { label: 'Client Ledger' } }],
            [
                { source: 'trade-api', target: 'client-ledger', data: { 'unique-id': 'trade-api-to-client-ledger' } },
                { source: 'client-ledger', target: 'trade-api', data: { 'unique-id': 'trade-api-to-client-ledger' } },
                { source: 'trade-api', target: 'gone' },
            ],
        );
        expect(labels.get('trade-api')).toBe('Trade API');
        expect(labels.get('trade-api-to-client-ledger')).toBe('Trade API → Client Ledger');
        expect(labels.size).toBe(3);
    });
});
