import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TabButton } from './TabButton';

describe('TabButton', () => {
    it('renders children text', () => {
        render(<TabButton isActive={false} onClick={vi.fn()}>Flows (3)</TabButton>);

        expect(screen.getByRole('button', { name: 'Flows (3)' })).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
        const onClick = vi.fn();
        render(<TabButton isActive={false} onClick={onClick}>Tab</TabButton>);

        fireEvent.click(screen.getByRole('button', { name: 'Tab' }));

        expect(onClick).toHaveBeenCalledOnce();
    });

    it('applies active styling when isActive is true', () => {
        render(<TabButton isActive={true} onClick={vi.fn()}>Active</TabButton>);

        const button = screen.getByRole('button', { name: 'Active' });
        expect(button.style.color).toBe('rgb(255, 255, 255)');
    });

    it('applies inactive styling when isActive is false', () => {
        render(<TabButton isActive={false} onClick={vi.fn()}>Inactive</TabButton>);

        const button = screen.getByRole('button', { name: 'Inactive' });
        expect(button.style.background).toBe('transparent');
    });
});
