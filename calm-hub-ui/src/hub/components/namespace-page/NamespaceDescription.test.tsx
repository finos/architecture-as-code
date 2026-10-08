import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NamespaceDescription } from './NamespaceDescription.js';
import { mockHeights, mockViewport } from '../../../test-support/layout-mocks.js';

const DESCRIPTION = 'Patterns, standards and sample architectures that the CALM project maintains.';

describe('NamespaceDescription', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows the full text as a tooltip on desktop, with no toggle', () => {
        mockHeights(80, 40);
        render(<NamespaceDescription description={DESCRIPTION} />);

        expect(screen.getByTestId('namespace-description')).toHaveAttribute('title', DESCRIPTION);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    describe('on mobile', () => {
        let restore: () => void;
        beforeEach(() => {
            restore = mockViewport(true);
        });
        afterEach(() => {
            restore();
        });

        it('toggles between the clamped and the full description when the text is cut off', () => {
            mockHeights(80, 40);
            render(<NamespaceDescription description={DESCRIPTION} />);
            const text = screen.getByTestId('namespace-description');
            expect(text).toHaveClass('line-clamp-2');
            expect(text).not.toHaveAttribute('title');

            fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
            expect(text).not.toHaveClass('line-clamp-2');
            expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');

            fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
            expect(text).toHaveClass('line-clamp-2');
        });

        it('shows no toggle when the description fits', () => {
            mockHeights(40, 40);
            render(<NamespaceDescription description={DESCRIPTION} />);
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });
    });
});
