import { describe, it, expect } from 'vitest';
import { newestFirst } from './controlEvaluations.js';
import type { ControlEvaluationDecorator } from '../../../contracts/contracts.js';

const d = (id: string, control: string, status: 'met' | 'not-met' | 'not-applicable', at: string, appliesTo: string[], extra = {}): ControlEvaluationDecorator => ({
    schema: 'https://calm.finos.org/standards/control-evaluation/1.0/control-evaluation.decorator.standard.json',
    uniqueId: id,
    type: 'control-evaluation',
    target: ['/api/calm/namespaces/ns/architectures/1/versions/1-0-0'],
    appliesTo,
    data: { control: { 'unique-id': control, 'requirement-url': 'https://example.org/r' }, status, 'evaluated-at': at, ...extra },
});

describe('newestFirst', () => {
    it('orders by parsed time and breaks ties by the greater uniqueId first', () => {
        const whole = d('whole', 'c', 'met', '2026-11-04T15:00:00Z', ['n']);
        const frac = d('frac', 'c', 'met', '2026-11-04T15:00:00.500Z', ['n']);
        const a = d('a', 'c', 'met', '2026-11-04T14:00:00.000Z', ['n']);
        const b = d('b', 'c', 'met', '2026-11-04T14:00:00Z', ['n']);
        expect(newestFirst([a, whole, b, frac]).map((x) => x.uniqueId)).toEqual(['frac', 'whole', 'b', 'a']);
        expect(newestFirst([frac, b, whole, a]).map((x) => x.uniqueId)).toEqual(['frac', 'whole', 'b', 'a']);
    });

    it('orders by evaluated-at, newest first', () => {
        const out = newestFirst([d('a', 'c', 'met', '2026-11-04T15:00:00.000Z', ['n']), d('b', 'c', 'met', '2026-11-04T15:02:00.000Z', ['n'])]);
        expect(out.map((x) => x.uniqueId)).toEqual(['b', 'a']);
    });

    it('lists one decision\'s equal-time evaluations not met, then met, then not applicable or unknown, then by uniqueId', () => {
        const at = '2026-11-04T15:00:00Z';
        const met = d('z-met', 'c1', 'met', at, ['n']);
        const notMet = d('a-not-met', 'c2', 'not-met', at, ['n']);
        const na = d('y-na', 'c3', 'not-applicable', at, ['n']);
        const unknown = d('zz-unknown', 'c4', 'met', at, ['n'], { status: 'pending' });
        const met2 = d('b-met', 'c5', 'met', at, ['n']);
        const older = d('zzz-not-met', 'c6', 'not-met', '2026-11-04T14:00:00Z', ['n']);
        expect(newestFirst([met, older, unknown, na, met2, notMet]).map((x) => x.uniqueId))
            .toEqual(['a-not-met', 'z-met', 'b-met', 'zz-unknown', 'y-na', 'zzz-not-met']);
    });
});
