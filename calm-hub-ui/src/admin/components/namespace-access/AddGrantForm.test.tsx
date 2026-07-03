import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AddGrantForm } from './AddGrantForm.js';

describe('AddGrantForm', () => {
    it('renders username input and permission select', () => {
        render(<AddGrantForm onSubmit={vi.fn()} />);
        expect(screen.getByRole('textbox', { name: /username/i })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: /permission/i })).toBeInTheDocument();
    });

    it('submit button is disabled when username is empty', () => {
        render(<AddGrantForm onSubmit={vi.fn()} />);
        expect(screen.getByRole('button', { name: /grant access/i })).toBeDisabled();
    });

    it('submit button enables when username is entered', () => {
        render(<AddGrantForm onSubmit={vi.fn()} />);
        fireEvent.change(screen.getByRole('textbox', { name: /username/i }), {
            target: { value: 'alice' },
        });
        expect(screen.getByRole('button', { name: /grant access/i })).not.toBeDisabled();
    });

    it('calls onSubmit with trimmed username and selected permission', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(<AddGrantForm onSubmit={onSubmit} />);

        fireEvent.change(screen.getByRole('textbox', { name: /username/i }), {
            target: { value: '  alice  ' },
        });
        fireEvent.change(screen.getByRole('combobox', { name: /permission/i }), {
            target: { value: 'write' },
        });
        fireEvent.click(screen.getByRole('button', { name: /grant access/i }));

        await waitFor(() =>
            expect(onSubmit).toHaveBeenCalledWith({ username: 'alice', permission: 'write' })
        );
    });

    it('resets the form after a successful submit', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(<AddGrantForm onSubmit={onSubmit} />);

        const input = screen.getByRole('textbox', { name: /username/i });
        fireEvent.change(input, { target: { value: 'alice' } });
        fireEvent.click(screen.getByRole('button', { name: /grant access/i }));

        await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
    });

    it('shows an error message when onSubmit rejects', async () => {
        const onSubmit = vi.fn().mockRejectedValue(new Error('fail'));
        render(<AddGrantForm onSubmit={onSubmit} />);

        fireEvent.change(screen.getByRole('textbox', { name: /username/i }), {
            target: { value: 'alice' },
        });
        fireEvent.click(screen.getByRole('button', { name: /grant access/i }));

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(/failed to grant/i)
        );
    });

    it('disables inputs while submitting', async () => {
        let resolve: () => void;
        const onSubmit = vi.fn().mockImplementation(
            () => new Promise<void>((r) => { resolve = r; })
        );
        render(<AddGrantForm onSubmit={onSubmit} />);

        fireEvent.change(screen.getByRole('textbox', { name: /username/i }), {
            target: { value: 'alice' },
        });
        fireEvent.click(screen.getByRole('button', { name: /grant access/i }));

        await waitFor(() =>
            expect(screen.getByRole('textbox', { name: /username/i })).toBeDisabled()
        );
        resolve!();
    });
});
