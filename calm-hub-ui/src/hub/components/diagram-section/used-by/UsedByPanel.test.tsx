import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UsedByPanel } from './UsedByPanel.js';
import { architectureHref } from './usedBy.js';
import type { ImplementationsState } from './usePatternImplementations.js';

describe('UsedByPanel', () => {
    it('links each architecture by its name and opens it in a new tab', () => {
        render(
            <UsedByPanel
                state={{
                    status: 'loaded',
                    implementations: [{ namespace: 'finos', architectureId: 7, version: '1.2.0', customId: 'trade-capture' }],
                }}
            />
        );

        const link = screen.getByRole('link', { name: /trade-capture/ });
        expect(link).toHaveAttribute('href', '#/finos/architectures/trade-capture/1.2.0');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(screen.getByText('finos · version 1.2.0')).toBeInTheDocument();
    });

    it('links an architecture that has no name by its numeric id', () => {
        render(
            <UsedByPanel state={{ status: 'loaded', implementations: [{ namespace: 'finos', architectureId: 9, version: '1.0.0' }] }} />
        );

        expect(screen.getByRole('link', { name: /Architecture 9/ })).toHaveAttribute('href', '#/finos/architectures/9/1.0.0');
    });

    it.each<[ImplementationsState, string]>([
        [{ status: 'loaded', implementations: [] }, 'No architectures use this version.'],
        [{ status: 'idle' }, 'Loading…'],
        [{ status: 'loading' }, 'Loading…'],
        [{ status: 'error' }, 'Could not load the architectures that use this version.'],
        [{ status: 'unavailable' }, 'Not available for this pattern.'],
    ])('shows a message for the %o state', (state, text) => {
        render(<UsedByPanel state={state} />);

        expect(screen.getByText(text)).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('encodes each segment of the link', () => {
        expect(architectureHref({ namespace: 'a b', architectureId: 1, version: '1.0.0', customId: 'x/y' })).toBe(
            '#/a%20b/architectures/x%2Fy/1.0.0'
        );
    });
});
