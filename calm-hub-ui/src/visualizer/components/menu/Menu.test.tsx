import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Menu } from './Menu.js';

describe('Menu', () => {
    const handleUploadMock = vi.fn();
    const toggleConnectionDescMock = vi.fn();
    const toggleNodeDescMock = vi.fn();

    const renderMenu = () => {
        return render(<Menu handleUpload={handleUploadMock} />);
    };

    it('should render Menu', () => {
        renderMenu();
        expect(screen.getByText('Upload Architecture')).toBeInTheDocument();
    });

    it('should call handleUpload on file input change', async () => {
        renderMenu();
        const file = new File(['example content'], 'example.txt', { type: 'text/plain' });
        const input = screen.getByTestId('file-input');
        const user = userEvent.setup();
        await user.upload(input, file);
        await waitFor(() => {
            expect(handleUploadMock).toHaveBeenCalledWith(file);
        });
    });
});
