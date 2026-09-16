import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./lab/Lab', () => ({ default: () => <div data-testid="lab" /> }));

import App from './App';

describe('App header', () => {
    it('mirrors the docs navbar: logo, CALM title and the Learning Lab label', () => {
        render(<App />);
        expect(screen.getByRole('img', { name: 'CALM Logo' })).toHaveAttribute('src', '/img/2025_CALM_Icon.svg');
        expect(screen.getByText('CALM')).toBeInTheDocument();
        expect(screen.getByText('Learning Lab')).toBeInTheDocument();
    });

    it('links to Docs, CALM Hub and GitHub, each opening in a new tab without opener/referrer', () => {
        render(<App />);
        const expected: Record<string, string> = {
            Docs: 'https://calm.finos.org/',
            'CALM Hub': 'https://hub.calm.finos.org/',
            GitHub: 'https://github.com/finos/architecture-as-code',
        };
        for (const [label, href] of Object.entries(expected)) {
            const link = screen.getByRole('link', { name: label });
            expect(link).toHaveAttribute('href', href);
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        }
    });

    it('renders the lab inside the frame', () => {
        render(<App />);
        expect(screen.getByTestId('lab')).toBeInTheDocument();
    });

    it('has the docs-style colour-mode toggle: light by default, dark on click, white logo in dark mode', async () => {
        const user = userEvent.setup();
        render(<App />);
        const toggle = screen.getByRole('button', { name: /currently light mode/ });
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');

        await user.click(toggle);
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(screen.getByRole('button', { name: /currently dark mode/ })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'CALM Logo' })).toHaveAttribute('src', '/img/2025_CALM_Icon_WHT.svg');
        expect(localStorage.getItem('theme')).toBe('dark');
    });
});
