import { describe, it, expect } from 'vitest';
import {
    isInteracts,
    isConnects,
    isComposedOf,
    isDeployedIn,
    isOptions,
    visitRelationship,
    toKindView,
    CalmRelationshipTypeCanonicalModel,
} from './template-models';

const interacts: CalmRelationshipTypeCanonicalModel = {
    interacts: { actor: 'user', nodes: ['svc-a'] },
};
const connects: CalmRelationshipTypeCanonicalModel = {
    connects: {
        source: { node: 'svc-a' },
        destination: { node: 'svc-b' },
    },
};
const composedOf: CalmRelationshipTypeCanonicalModel = {
    'composed-of': { container: 'svc-c', nodes: ['svc-a', 'svc-b'] },
};
const deployedIn: CalmRelationshipTypeCanonicalModel = {
    'deployed-in': { container: 'cluster-1', nodes: ['svc-a'] },
};
const options: CalmRelationshipTypeCanonicalModel = {
    options: [{ description: 'opt-1', nodes: ['svc-a'] }],
};

describe('relationship type guards', () => {
    it('isInteracts narrows interacts and rejects others', () => {
        expect(isInteracts(interacts)).toBe(true);
        expect(isInteracts(connects)).toBe(false);
    });

    it('isConnects narrows connects and rejects others', () => {
        expect(isConnects(connects)).toBe(true);
        expect(isConnects(interacts)).toBe(false);
    });

    it('isComposedOf narrows composed-of and rejects others', () => {
        expect(isComposedOf(composedOf)).toBe(true);
        expect(isComposedOf(connects)).toBe(false);
    });

    it('isDeployedIn narrows deployed-in and rejects others', () => {
        expect(isDeployedIn(deployedIn)).toBe(true);
        expect(isDeployedIn(connects)).toBe(false);
    });

    it('isOptions narrows options and rejects others', () => {
        expect(isOptions(options)).toBe(true);
        expect(isOptions(connects)).toBe(false);
    });
});

describe('visitRelationship', () => {
    it('dispatches to interacts handler', () => {
        const out = visitRelationship<string>(interacts, {
            interacts: (r) => `i:${r.interacts.actor}`,
            default: () => 'default',
        });
        expect(out).toBe('i:user');
    });

    it('dispatches to connects handler', () => {
        const out = visitRelationship<string>(connects, {
            connects: (r) => `c:${r.connects.source.node}->${r.connects.destination.node}`,
            default: () => 'default',
        });
        expect(out).toBe('c:svc-a->svc-b');
    });

    it('dispatches to composedOf handler', () => {
        const out = visitRelationship<string>(composedOf, {
            composedOf: (r) => `co:${r['composed-of'].container}`,
            default: () => 'default',
        });
        expect(out).toBe('co:svc-c');
    });

    it('dispatches to deployedIn handler', () => {
        const out = visitRelationship<string>(deployedIn, {
            deployedIn: (r) => `d:${r['deployed-in'].container}`,
            default: () => 'default',
        });
        expect(out).toBe('d:cluster-1');
    });

    it('dispatches to options handler', () => {
        const out = visitRelationship<string>(options, {
            options: (r) => `o:${r.options.length}`,
            default: () => 'default',
        });
        expect(out).toBe('o:1');
    });

    it('falls through to default when no matching handler is provided', () => {
        const out = visitRelationship<string>(interacts, { default: () => 'fallback' });
        expect(out).toBe('fallback');
    });
});

describe('toKindView', () => {
    it('maps interacts to kind view', () => {
        expect(toKindView(interacts)).toEqual({
            kind: 'interacts',
            actor: 'user',
            nodes: ['svc-a'],
        });
    });

    it('maps connects to kind view', () => {
        expect(toKindView(connects)).toEqual({
            kind: 'connects',
            source: { node: 'svc-a' },
            destination: { node: 'svc-b' },
        });
    });

    it('maps composed-of to kind view', () => {
        expect(toKindView(composedOf)).toEqual({
            kind: 'composed-of',
            container: 'svc-c',
            nodes: ['svc-a', 'svc-b'],
        });
    });

    it('maps deployed-in to kind view', () => {
        expect(toKindView(deployedIn)).toEqual({
            kind: 'deployed-in',
            container: 'cluster-1',
            nodes: ['svc-a'],
        });
    });

    it('maps options to kind view', () => {
        expect(toKindView(options)).toEqual({
            kind: 'options',
            options: [{ description: 'opt-1', nodes: ['svc-a'] }],
        });
    });

    it('throws on an unrecognised relationship type', () => {
        const bogus = {} as CalmRelationshipTypeCanonicalModel;
        expect(() => toKindView(bogus)).toThrow('Unknown relationship type');
    });
});
