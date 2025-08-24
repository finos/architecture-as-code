import { describe, it, expect } from 'vitest';
import { Resolvable, ResolvableAndAdaptable } from './resolvable';


describe('Resolvable', () => {
    it('should be unresolved if no value is set', () => {
        const r = new Resolvable('http://example.com/foo');
        expect(r.isResolved).toBe(false);
    });

    it('should throw if value is accessed before resolved', () => {
        const r = new Resolvable('http://example.com/foo');
        expect(() => r.value).toThrow('Value not resolved');
    });

    it('should resolve and set value via dereference', async () => {
        const r = new Resolvable('http://example.com/foo');
        await r.dereference(async (url) => ({ foo: 'bar', url }));
        expect(r.isResolved).toBe(true);
        expect(r.value).toEqual({ foo: 'bar', url: 'http://example.com/foo' });
    });

    it('should not call resolver if already resolved', async () => {
        const r = new Resolvable('http://example.com/foo');
        let called = false;
        await r.dereference(async (_url) => {
            called = true;
            return { foo: 'bar' };
        });
        called = false;
        await r.dereference(async (_url) => {
            called = true;
            return { foo: 'baz' };
        });
        expect(called).toBe(false);
        expect(r.value).toEqual({ foo: 'bar' });
    });
});

describe('ResolvableAndAdaptable', () => {
    it('should be unresolved if no value is set', () => {
        const r = new ResolvableAndAdaptable('http://example.com/foo', (s: unknown) => s + ' adapted');
        expect(r.isResolved).toBe(false);
    });

    it('should throw if value is accessed before resolved', () => {
        const r = new ResolvableAndAdaptable('http://example.com/foo', (s: unknown) => s + ' adapted');
        expect(() => r.value).toThrow('Value not resolved');
    });

    it('should resolve and adapt value via dereference', async () => {
        const r = new ResolvableAndAdaptable('http://example.com/foo', (s: string) => s.toUpperCase());
        await r.dereference(async (_url) => 'bar');
        expect(r.isResolved).toBe(true);
        expect(r.value).toBe('BAR');
    });

    it('should not call resolver if already resolved', async () => {
        const r = new ResolvableAndAdaptable('http://example.com/foo', (s: string) => s + ' adapted');
        let called = false;
        await r.dereference(async (_url) => {
            called = true;
            return 'bar';
        });
        called = false;
        await r.dereference(async (_url) => {
            called = true;
            return 'baz';
        });
        expect(called).toBe(false);
        expect(r.value).toBe('bar adapted');
    });
});

