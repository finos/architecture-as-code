import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCalloutSizes } from './DecisionOverlayContext.js';

describe('useCalloutSizes', () => {
    it('keeps the size each callout reports, and drops it when the callout goes', () => {
        const { result } = renderHook(() => useCalloutSizes());
        act(() => result.current.reportCalloutSize('a', { width: 220, height: 90 }));
        expect(result.current.calloutSizes).toEqual(new Map([['a', { width: 220, height: 90 }]]));

        act(() => result.current.reportCalloutSize('a', undefined));
        expect(result.current.calloutSizes.size).toBe(0);
    });

    it('keeps the same map when a report changes nothing, so the diagram does not render again', () => {
        const { result } = renderHook(() => useCalloutSizes());
        act(() => result.current.reportCalloutSize('a', { width: 220, height: 90 }));
        const sizes = result.current.calloutSizes;
        act(() => {
            result.current.reportCalloutSize('a', { width: 220, height: 90 });
            result.current.reportCalloutSize('b', undefined);
        });
        expect(result.current.calloutSizes).toBe(sizes);
    });

    it('reads the latest sizes through a function that keeps its identity', () => {
        const { result } = renderHook(() => useCalloutSizes());
        const { currentCalloutSizes, reportCalloutSize } = result.current;
        act(() => reportCalloutSize('a', { width: 220, height: 90 }));
        expect(result.current.currentCalloutSizes).toBe(currentCalloutSizes);
        expect(result.current.reportCalloutSize).toBe(reportCalloutSize);
        expect(currentCalloutSizes().get('a')).toEqual({ width: 220, height: 90 });
    });
});
