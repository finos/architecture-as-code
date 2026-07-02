import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { RailItem } from './RailItem.js';

const renderItem = (props: { label: string; count: number; active: boolean; to: string }) =>
    render(
        <MemoryRouter>
            <RailItem {...props} />
        </MemoryRouter>
    );

describe('RailItem', () => {
    it('renders the label and a count badge linking to its route', () => {
        renderItem({ label: 'finos', count: 5, active: false, to: '/namespace/finos' });
        const link = screen.getByRole('link', { name: /finos/ });
        expect(link).toHaveAttribute('href', '/namespace/finos');
        expect(screen.getByTestId('count-badge')).toHaveTextContent('5');
    });

    it('applies the active tint, accent and aria-current when active', () => {
        renderItem({ label: 'finos', count: 5, active: true, to: '/namespace/finos' });
        const link = screen.getByRole('link', { name: /finos/ });
        expect(link).toHaveStyle({ backgroundColor: '#EEF4FF' });
        expect(link).toHaveStyle({ boxShadow: 'inset 3px 0 0 #2563EB' });
        expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('does not set aria-current when resting', () => {
        renderItem({ label: 'finos', count: 5, active: false, to: '/namespace/finos' });
        expect(screen.getByRole('link', { name: /finos/ })).not.toHaveAttribute('aria-current');
    });
});
