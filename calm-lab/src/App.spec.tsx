import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import appCss from './app.css?inline';

vi.mock('./lab/Lab', () => ({
    default: ({lesson}: {lesson: {id: string}}) => <div data-testid="lab" data-lesson={lesson.id} />,
}));

import App from './App';
import { QUICK_START } from './test-support/quick-start-lesson';

const lessons = [QUICK_START, { ...QUICK_START, id: 'other', title: 'Other' }];

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

    it('keeps the navbar stable on narrow screens', () => {
        // jsdom has no layout engine, so lock the CSS invariants that prevent this regression.
        expect(appCss).toMatch(/\.navbar__brand\s*\{[^}]*flex-shrink:\s*0;/);
        expect(appCss).toMatch(/\.navbar__link\s*\{[^}]*white-space:\s*nowrap;/);
        expect(appCss).toMatch(/\.colorModeToggle\s*\{[^}]*flex-shrink:\s*0;/);
        expect(appCss).toMatch(
            /@media \(max-width: 460px\)[\s\S]*?\.navbar__external\s*\{\s*display:\s*none;\s*\}/,
        );
        expect(appCss).toMatch(
            /@media \(max-width: 340px\)[\s\S]*?\.navbar__logo\s*\{\s*display:\s*none;\s*\}/,
        );
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

describe('lesson selection', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/');
    });

    it('opens the lesson named in the URL', () => {
        window.history.replaceState(null, '', '/?lesson=other');
        render(<App lessons={lessons} />);
        expect(screen.getByTestId('lab')).toHaveAttribute('data-lesson', 'other');
    });

    it('explains an unknown lesson id and rewrites the URL', () => {
        window.history.replaceState(null, '', '/?lesson=nope');
        render(<App lessons={lessons} />);
        expect(screen.getByRole('status')).toHaveTextContent('There is no lesson called “nope”. Opened “Quick start: model a trading system” instead.');
        expect(window.location.search).toBe('?lesson=quick-start');
    });

    it('remembers the lesson it opens, so the lab root returns to it', () => {
        window.history.replaceState(null, '', '/?lesson=other');
        render(<App lessons={lessons} />);
        expect(JSON.parse(localStorage.getItem('calm-lab-ui-v1')!).lesson).toBe('other');
    });
});
