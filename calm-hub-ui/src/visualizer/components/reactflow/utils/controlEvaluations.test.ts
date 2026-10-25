import { describe, it, expect } from 'vitest';
import { containersOfContainment, evaluationsByElement, newestFirst } from './controlEvaluations.js';
import type { ControlEvaluationDecorator } from '../../../contracts/contracts.js';

const d = (id: string, control: string, status: 'met' | 'not-met' | 'not-applicable', at: string, appliesTo: string[], extra = {}): ControlEvaluationDecorator => ({
    schema: 'https://calm.finos.org/draft/2026-03/standards/compliance/control-evaluation.decorator.standard.json',
    uniqueId: id,
    type: 'control-evaluation',
    target: ['/api/calm/namespaces/ns/architectures/1/versions/1-0-0'],
    appliesTo,
    data: { control: { 'unique-id': control, 'requirement-url': 'https://example.org/r' }, status, 'evaluated-at': at, ...extra },
});

describe('evaluationsByElement', () => {
    it('keeps the newest evaluation per control and element', () => {
        const map = evaluationsByElement([
            d('a', 'code-review', 'not-met', '2026-11-04T15:00:00.000Z', ['trade-api']),
            d('b', 'code-review', 'met', '2026-11-04T15:01:00.000Z', ['trade-api']),
        ]);
        expect(map.get('trade-api')?.status).toBe('met');
        expect(map.get('trade-api')?.latest.map((x) => x.uniqueId)).toEqual(['b']);
    });

    it('is not met when any control is not met', () => {
        const map = evaluationsByElement([
            d('a', 'code-review', 'met', '2026-11-04T15:00:00.000Z', ['trade-api']),
            d('b', 'client-ledger', 'not-met', '2026-11-04T15:00:00.000Z', ['trade-api', 'trade-api-to-client-ledger']),
        ]);
        expect(map.get('trade-api')?.status).toBe('not-met');
        expect(map.get('trade-api-to-client-ledger')?.status).toBe('not-met');
        expect(map.get('trade-api')?.latest.map((x) => x.uniqueId)).toEqual(['b', 'a']);
    });

    it('shows nothing for an element whose latest evaluations are all not applicable', () => {
        const map = evaluationsByElement([
            d('a', 'client-ledger', 'not-met', '2026-11-04T15:00:00.000Z', ['client-ledger']),
            d('b', 'client-ledger', 'not-applicable', '2026-11-04T15:05:00.000Z', ['client-ledger']),
        ]);
        expect(map.has('client-ledger')).toBe(false);
    });

    it('skips decorators without a control or a time, and ignores nothing else', () => {
        const broken = { ...d('x', 'c', 'not-met', '2026-11-04T15:00:00.000Z', ['n']), data: { status: 'not-met' } } as unknown as ControlEvaluationDecorator;
        const noTime = { ...d('y', 'c', 'not-met', '', ['m']), data: { control: { 'unique-id': 'c', 'requirement-url': 'https://example.org/r' }, status: 'not-met' } } as unknown as ControlEvaluationDecorator;
        const map = evaluationsByElement([broken, noTime, d('a', 'c', 'met', '2026-11-04T15:00:00.000Z', ['services/x.ts'])]);
        expect(map.has('n')).toBe(false);
        expect(map.has('m')).toBe(false);
        expect(map.get('services/x.ts')?.status).toBe('met');
    });

    it('never counts a status other than met or not-met', () => {
        const bogus = (id: string, at: string, appliesTo: string[]) => ({ ...d(id, 'c', 'met', at, appliesTo), data: { ...d(id, 'c', 'met', at, appliesTo).data, status: 'bogus' } }) as unknown as ControlEvaluationDecorator;
        const missing = { ...d('m', 'c', 'met', '2026-11-04T15:00:00.000Z', ['p']), data: { control: { 'unique-id': 'c', 'requirement-url': 'https://example.org/r' }, 'evaluated-at': '2026-11-04T15:00:00.000Z' } } as unknown as ControlEvaluationDecorator;
        const map = evaluationsByElement([bogus('x', '2026-11-04T15:00:00.000Z', ['n']), missing]);
        expect(map.has('n')).toBe(false);
        expect(map.has('p')).toBe(false);
    });

    it('skips a decorator with an unknown status before choosing the latest, so an older met remains', () => {
        const newerBogus = { ...d('z', 'c', 'met', '2026-11-04T16:00:00.000Z', ['n']), data: { ...d('z', 'c', 'met', '2026-11-04T16:00:00.000Z', ['n']).data, status: 'bogus' } } as unknown as ControlEvaluationDecorator;
        const map = evaluationsByElement([d('a', 'c', 'met', '2026-11-04T15:00:00.000Z', ['n']), newerBogus]);
        expect(map.get('n')?.status).toBe('met');
        expect(map.get('n')?.latest.map((x) => x.uniqueId)).toEqual(['a']);
    });

    it('compares evaluated-at by parsed time, not as text', () => {
        const map = evaluationsByElement([
            d('frac', 'c', 'not-met', '2026-11-04T15:00:00.500Z', ['n']),
            d('whole', 'c', 'met', '2026-11-04T15:00:00Z', ['n']),
        ]);
        expect(map.get('n')?.latest.map((x) => x.uniqueId)).toEqual(['frac']);
    });

    it('skips a decorator whose evaluated-at does not parse', () => {
        const map = evaluationsByElement([
            d('a', 'c', 'met', '2026-11-04T15:00:00.000Z', ['n']),
            d('b', 'c', 'not-met', 'not-a-time', ['n']),
            d('x', 'c', 'met', 'yesterday', ['only-bad']),
        ]);
        expect(map.get('n')?.latest.map((x) => x.uniqueId)).toEqual(['a']);
        expect(map.has('only-bad')).toBe(false);
    });

    it('breaks a tie on time by uniqueId, the greater uniqueId winning, whatever the input order', () => {
        const a = d('a', 'c', 'not-met', '2026-11-04T15:00:00Z', ['n']);
        const b = d('b', 'c', 'met', '2026-11-04T15:00:00.000Z', ['n']);
        expect(evaluationsByElement([a, b]).get('n')?.latest.map((x) => x.uniqueId)).toEqual(['b']);
        expect(evaluationsByElement([b, a]).get('n')?.latest.map((x) => x.uniqueId)).toEqual(['b']);
    });
});

describe('containment relationships', () => {
    const relationships = [
        { 'unique-id': 'api-in-cluster', 'relationship-type': { 'deployed-in': { container: 'cluster', nodes: ['trade-api'] } } },
        { 'unique-id': 'system-has-ledger', 'relationship-type': { 'composed-of': { container: 'trade-system', nodes: ['client-ledger'] } } },
        { 'unique-id': 'api-to-ledger', 'relationship-type': { connects: { source: { node: 'trade-api' }, destination: { node: 'client-ledger' } } } },
    ];

    it('maps each deployed-in and composed-of relationship to its container, and nothing else', () => {
        expect([...containersOfContainment(relationships)]).toEqual([
            ['api-in-cluster', 'cluster'],
            ['system-has-ledger', 'trade-system'],
        ]);
        expect(containersOfContainment(undefined).size).toBe(0);
    });

    it('counts a containment relationship\'s evaluation for its container, which draws it', () => {
        const map = evaluationsByElement(
            [d('a', 'residency', 'not-met', '2026-11-04T15:00:00.000Z', ['api-in-cluster'])],
            containersOfContainment(relationships),
        );
        expect(map.get('cluster')?.status).toBe('not-met');
        expect(map.has('api-in-cluster')).toBe(false);
    });

    it('counts one evaluation once when it names both the container and its relationship', () => {
        const map = evaluationsByElement(
            [d('a', 'residency', 'not-met', '2026-11-04T15:00:00.000Z', ['cluster', 'api-in-cluster', 'trade-api'])],
            containersOfContainment(relationships),
        );
        expect(map.get('cluster')?.latest.map((x) => x.uniqueId)).toEqual(['a']);
        expect(map.get('trade-api')?.status).toBe('not-met');
    });
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
