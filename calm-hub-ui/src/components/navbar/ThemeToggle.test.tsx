import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from './ThemeToggle.js';

describe('ThemeToggle', () => {
    it('offers to switch to dark while the light theme is active', () => {
        render(<ThemeToggle theme="light" onToggle={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
    });

    it('offers to switch to light while the dark theme is active', () => {
        render(<ThemeToggle theme="dark" onToggle={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
    });

    it('calls onToggle when pressed', async () => {
        const user = userEvent.setup();
        const onToggle = vi.fn();
        render(<ThemeToggle theme="light" onToggle={onToggle} />);

        await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

        expect(onToggle).toHaveBeenCalledOnce();
    });

    it('is never hidden at a breakpoint — the search bar it sits beside is', () => {
        // Regression guard: the toggle must not inherit the `hidden lg:flex` wrapper
        // that hides GlobalSearchBar on mobile.
        render(<ThemeToggle theme="light" onToggle={vi.fn()} />);
        const button = screen.getByRole('button', { name: 'Switch to dark theme' });
        expect(button.className).not.toMatch(/\bhidden\b/);
    });
});
