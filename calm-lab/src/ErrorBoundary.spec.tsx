import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function Boom(): never {
    throw new Error('kaboom');
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
    it('renders its children while they behave', () => {
        render(<ErrorBoundary fallback={<span>fallback</span>}><span>content</span></ErrorBoundary>);
        expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('swaps in the fallback and logs when a child throws', () => {
        // React logs the caught error itself; silence both it and ours.
        const error = vi.spyOn(console, 'error').mockImplementation(() => { });
        render(<ErrorBoundary fallback={<span>fallback</span>}><Boom /></ErrorBoundary>);
        expect(screen.getByText('fallback')).toBeInTheDocument();
        expect(error).toHaveBeenCalledWith(
            'CALM lab: render error',
            expect.objectContaining({ message: 'kaboom' }),
            expect.anything(),
        );
    });

    it('retries when the key changes', () => {
        vi.spyOn(console, 'error').mockImplementation(() => { });
        const { rerender } = render(
            <ErrorBoundary key="first" fallback={<span>fallback</span>}><Boom /></ErrorBoundary>,
        );
        expect(screen.getByText('fallback')).toBeInTheDocument();
        rerender(
            <ErrorBoundary key="second" fallback={<span>fallback</span>}><span>content</span></ErrorBoundary>,
        );
        expect(screen.getByText('content')).toBeInTheDocument();
    });
});
