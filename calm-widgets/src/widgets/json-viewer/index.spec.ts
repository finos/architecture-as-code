import { describe, it, expect } from 'vitest';
import { JsonViewerWidget } from './index';

describe('JsonViewerWidget', () => {
    describe('validateContext', () => {
        it('always returns true', () => {
            expect(JsonViewerWidget.validateContext(null)).toBe(true);
            expect(JsonViewerWidget.validateContext({})).toBe(true);
            expect(JsonViewerWidget.validateContext([])).toBe(true);
            expect(JsonViewerWidget.validateContext('anything')).toBe(true);
        });
    });

    describe('transformToViewModel', () => {
        it('wraps context in { context } object', () => {
            const input = { foo: 'bar' };
            const vm = JsonViewerWidget.transformToViewModel!(input, {});
            expect(vm).toEqual({ context: input });
        });

        it('works with primitive context values', () => {
            expect(JsonViewerWidget.transformToViewModel!(42, {})).toEqual({ context: 42 });
            expect(JsonViewerWidget.transformToViewModel!('hello', {})).toEqual({ context: 'hello' });
        });

        it('works with undefined context', () => {
            expect(JsonViewerWidget.transformToViewModel!(undefined, {})).toEqual({ context: undefined });
        });
    });
});
