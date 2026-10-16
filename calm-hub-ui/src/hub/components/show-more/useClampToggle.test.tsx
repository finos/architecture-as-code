import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClampToggle } from './useClampToggle.js';
import { mockHeights } from '../../../test-support/layout-mocks.js';

function Probe({ text = 'A long description' }: { text?: string }) {
    const { ref, expanded, showToggle, toggle } = useClampToggle<HTMLParagraphElement>(text, true);
    return (
        <>
            <p ref={ref} style={{ lineHeight: '20px' }}>
                {text}
            </p>
            {showToggle && <button onClick={toggle}>{expanded ? 'less' : 'more'}</button>}
        </>
    );
}

describe('useClampToggle', () => {
    // The shared setup stubs ResizeObserver as a no-op. Swap in one that records its
    // callback, so a resize can be simulated. Globals are restored by hand, as in
    // ArchitectureGraph.test.tsx.
    let triggerResize: (() => void) | null;
    let disconnect: ReturnType<typeof vi.fn>;
    let originalResizeObserver: typeof globalThis.ResizeObserver;
    let fonts: EventTarget;

    beforeEach(() => {
        triggerResize = null;
        disconnect = vi.fn();
        originalResizeObserver = globalThis.ResizeObserver;
        globalThis.ResizeObserver = class {
            constructor(callback: ResizeObserverCallback) {
                triggerResize = () => callback([], this as unknown as ResizeObserver);
            }
            observe() {}
            unobserve() {}
            disconnect = disconnect;
        } as unknown as typeof globalThis.ResizeObserver;
        fonts = new EventTarget();
        Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
    });

    afterEach(() => {
        globalThis.ResizeObserver = originalResizeObserver;
        delete (document as { fonts?: unknown }).fonts;
        vi.restoreAllMocks();
    });

    it('measures again when the text is resized, as on a phone rotation', () => {
        mockHeights(40, 40);
        render(<Probe />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();

        mockHeights(80, 40);
        act(() => triggerResize?.());
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('measures again when a web font finishes loading', () => {
        mockHeights(40, 40);
        render(<Probe />);

        mockHeights(80, 40);
        act(() => {
            fonts.dispatchEvent(new Event('loadingdone'));
        });
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('drops "Show less" when a resize lets the expanded text fit in two lines', () => {
        mockHeights(80, 40);
        render(<Probe />);
        fireEvent.click(screen.getByRole('button', { name: 'more' }));
        expect(screen.getByRole('button', { name: 'less' })).toBeInTheDocument();

        // Expanded, the box is as tall as the text: two lines of 20px after the rotation.
        mockHeights(40, 40);
        act(() => triggerResize?.());
        expect(screen.queryByRole('button')).not.toBeInTheDocument();

        mockHeights(80, 80);
        act(() => triggerResize?.());
        expect(screen.getByRole('button', { name: 'less' })).toBeInTheDocument();
    });

    it('stops observing when it unmounts', () => {
        mockHeights(40, 40);
        const { unmount } = render(<Probe />);
        unmount();
        expect(disconnect).toHaveBeenCalled();
    });
});
