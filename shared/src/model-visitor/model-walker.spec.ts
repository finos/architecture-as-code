import { describe, it, expect, vi } from 'vitest';
import { Resolvable, ResolvableAndAdaptable } from '@finos/calm-models/model';
import { ModelWalker, ResolvableHook } from './model-walker';
import { CalmReferenceResolver, InMemoryResolver } from '../resolver/calm-reference-resolver';

/** A resolver that never dereferences — for tests that pre-resolve their nodes and only observe. */
const noopResolver: CalmReferenceResolver = {
    canResolve: () => false,
    resolve: async () => ({})
};

function recordingHook(): { hook: ResolvableHook, visits: { reference: string, path: string[] }[] } {
    const visits: { reference: string, path: string[] }[] = [];
    const hook: ResolvableHook = {
        onResolvable: async (node, path) => {
            visits.push({ reference: node.reference, path: [...path] });
        }
    };
    return { hook, visits };
}

describe('ModelWalker', () => {
    it('propagates the path to nested resolvables through objects and arrays', async () => {
        const inner = new Resolvable<object>('inner-ref', { leaf: true });
        const obj = { nodes: [{ details: inner }] };

        const { hook, visits } = recordingHook();
        await new ModelWalker(noopResolver, hook).walk(obj);

        expect(visits).toHaveLength(1);
        expect(visits[0].reference).toBe('inner-ref');
        expect(visits[0].path).toEqual(['nodes', '[0]', 'details']);
    });

    it('dereferences unresolved resolvables through the injected resolver', async () => {
        const resolve = vi.fn().mockResolvedValue({ leaf: true });
        const resolver: CalmReferenceResolver = { canResolve: () => true, resolve };
        const node = new Resolvable<object>('to-resolve');

        const { hook, visits } = recordingHook();
        await new ModelWalker(resolver, hook).walk({ item: node });

        expect(resolve).toHaveBeenCalledWith('to-resolve');
        expect(node.isResolved).toBe(true);
        expect(visits).toHaveLength(1);
        expect(visits[0].reference).toBe('to-resolve');
    });

    it('records a resolver failure as a walk error instead of throwing', async () => {
        const resolver: CalmReferenceResolver = {
            canResolve: () => true,
            resolve: vi.fn().mockRejectedValue(new Error('load failed'))
        };
        const node = new Resolvable<object>('bad-ref');

        const walker = new ModelWalker(resolver);
        await walker.walk({ item: node });

        expect(walker.errors).toHaveLength(1);
        expect(walker.errors[0].reference).toBe('bad-ref');
        expect(walker.errors[0].message).toContain('load failed');
    });

    it('terminates on a self-referential cycle and visits the reference once', async () => {
        const selfRef = new Resolvable<object>('self-ref');
        // resolve it to a structure that contains itself
        await selfRef.dereference(async () => ({ child: selfRef }));

        const { hook, visits } = recordingHook();
        await new ModelWalker(noopResolver, hook).walk(selfRef);

        expect(visits.filter(v => v.reference === 'self-ref')).toHaveLength(1);
    });

    it('terminates on a mutual (A -> B -> A) cycle', async () => {
        const a = new Resolvable<object>('a-ref');
        const b = new Resolvable<object>('b-ref');
        await a.dereference(async () => ({ next: b }));
        await b.dereference(async () => ({ next: a }));

        const { hook, visits } = recordingHook();
        await new ModelWalker(noopResolver, hook).walk(a);

        expect(visits.map(v => v.reference).sort()).toEqual(['a-ref', 'b-ref']);
    });

    it('visits legitimate duplicate references in sibling branches (not treated as a cycle)', async () => {
        const shared1 = new Resolvable<object>('shared-ref', { leaf: 1 });
        const shared2 = new Resolvable<object>('shared-ref', { leaf: 2 });
        const obj = { nodes: [{ ref: shared1 }, { ref: shared2 }] };

        const { hook, visits } = recordingHook();
        await new ModelWalker(noopResolver, hook).walk(obj);

        expect(visits.filter(v => v.reference === 'shared-ref')).toHaveLength(2);
    });

    it('collects hook errors instead of throwing, keying them by reference and path', async () => {
        const boom = new Resolvable<object>('boom-ref');
        const obj = { a: { b: boom } };

        const hook: ResolvableHook = {
            onResolvable: async () => {
                throw new Error('kaboom');
            }
        };
        const walker = new ModelWalker(noopResolver, hook);
        await walker.walk(obj);

        expect(walker.errors).toHaveLength(1);
        expect(walker.errors[0].reference).toBe('boom-ref');
        expect(walker.errors[0].path).toEqual(['a', 'b']);
        expect(walker.errors[0].message).toContain('kaboom');
    });

    it('ignores primitives and null without invoking the hook', async () => {
        const { hook, visits } = recordingHook();
        const walker = new ModelWalker(noopResolver, hook);

        await walker.walk(null);
        await walker.walk(42);
        await walker.walk('a string');
        await walker.walk({ a: 1, b: 'two', c: null });

        expect(visits).toHaveLength(0);
        expect(walker.errors).toHaveLength(0);
    });

    it('walks ResolvableAndAdaptable nodes', async () => {
        const adaptable = new ResolvableAndAdaptable<object, { adapted: boolean }>(
            'adaptable-ref',
            () => ({ adapted: true }),
            { adapted: true }
        );

        const { hook, visits } = recordingHook();
        await new ModelWalker(noopResolver, hook).walk({ item: adaptable });

        expect(visits).toHaveLength(1);
        expect(visits[0].reference).toBe('adaptable-ref');
    });

    it('can be driven end-to-end by an InMemoryResolver', async () => {
        const resolver = new InMemoryResolver({ 'x-ref': { leaf: true } });
        const node = new Resolvable<object>('x-ref');

        await new ModelWalker(resolver).walk({ item: node });

        expect(node.isResolved).toBe(true);
        expect(node.value).toEqual({ leaf: true });
    });
});
