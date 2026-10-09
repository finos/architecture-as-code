import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShowMoreToggle } from './ShowMoreToggle.js';

describe('ShowMoreToggle', () => {
    it('offers to show more while collapsed', () => {
        const onToggle = vi.fn();
        render(<ShowMoreToggle expanded={false} onToggle={onToggle} />);
        const button = screen.getByRole('button', { name: 'Show more' });
        expect(button).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(button);
        expect(onToggle).toHaveBeenCalledOnce();
    });

    it('offers to show less while expanded', () => {
        render(<ShowMoreToggle expanded onToggle={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
    });
});
