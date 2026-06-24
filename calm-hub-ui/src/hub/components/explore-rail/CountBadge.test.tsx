import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CountBadge } from './CountBadge.js';

describe('CountBadge', () => {
    it('renders the integer count', () => {
        render(<CountBadge count={42} />);
        expect(screen.getByTestId('count-badge')).toHaveTextContent('42');
    });

    it('renders a grey resting badge by default', () => {
        render(<CountBadge count={1} />);
        expect(screen.getByTestId('count-badge')).toHaveStyle({ backgroundColor: '#EEF2F7' });
    });

    it('fills blue with white text when active', () => {
        render(<CountBadge count={1} active />);
        const badge = screen.getByTestId('count-badge');
        expect(badge).toHaveStyle({ backgroundColor: '#2563EB' });
        expect(badge).toHaveStyle({ color: '#ffffff' });
    });

    it('renders zero', () => {
        render(<CountBadge count={0} />);
        expect(screen.getByTestId('count-badge')).toHaveTextContent('0');
    });
});
