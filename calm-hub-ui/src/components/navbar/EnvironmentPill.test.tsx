import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EnvironmentPill } from './EnvironmentPill.js';

describe('EnvironmentPill', () => {
    it.each(['info', 'success', 'warning', 'error', 'neutral'])('uses the DaisyUI badge class for the %s token', (colour) => {
        render(<EnvironmentPill environment={{ name: 'UAT', colour }} />);

        const pill = screen.getByTestId('environment-pill');
        expect(pill).toHaveClass(`badge-${colour}`);
        expect(pill).not.toHaveAttribute('style');
    });

    it('uses an inline style for a hex colour', () => {
        render(<EnvironmentPill environment={{ name: 'PROD', colour: '#b91c1c' }} />);

        expect(screen.getByTestId('environment-pill')).toHaveStyle({
            backgroundColor: '#b91c1c',
            color: '#ffffff',
        });
    });

    it('ignores a colour that is neither a token nor a hex colour', () => {
        render(<EnvironmentPill environment={{ name: 'DEV', colour: 'red; background: url(x)' }} />);

        const pill = screen.getByTestId('environment-pill');
        expect(pill).not.toHaveAttribute('style');
        expect(pill.className).not.toContain('red');
    });

    it('shows the full name as a tooltip, because a long name is truncated', () => {
        render(<EnvironmentPill environment={{ name: 'Pre-production EMEA', colour: 'info' }} />);

        expect(screen.getByTestId('environment-pill')).toHaveAttribute('title', 'Pre-production EMEA');
        expect(screen.getByText('Pre-production EMEA')).toBeInTheDocument();
    });
});
