import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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
});
