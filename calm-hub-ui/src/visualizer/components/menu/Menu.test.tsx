import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Menu } from './Menu.js';

describe('Menu', () => {
    const handleUploadMock = vi.fn();
    const toggleConnectionDescMock = vi.fn();
    const toggleNodeDescMock = vi.fn();

    const renderMenu = (isGraphRendered = true) => {
        return render(
            <Menu
                handleUpload={handleUploadMock}
                isGraphRendered={isGraphRendered}
                toggleConnectionDesc={toggleConnectionDescMock}
                toggleNodeDesc={toggleNodeDescMock}
                isConDescActive={true}
                isNodeDescActive={true}
            />
        );
    };

    it('should render Menu', () => {
        renderMenu();
        expect(screen.getByText('Relationship Descriptions')).toBeInTheDocument();
        expect(screen.getByText('Node Descriptions')).toBeInTheDocument();
        expect(screen.getByText('Upload Architecture')).toBeInTheDocument();
    });

    it('should call toggleConnectionDesc on checkbox click', async () => {
        renderMenu();
        const checkbox = screen.getByRole('checkbox', { name: 'connection-description' });
        fireEvent.click(checkbox);
        await waitFor(() => {
            expect(toggleConnectionDescMock).toHaveBeenCalledTimes(1);
        });
    });

    it('should call toggleNodeDesc on checkbox click', async () => {
        renderMenu();
        const checkbox = screen.getByRole('checkbox', { name: 'node-description' });
        fireEvent.click(checkbox);
        await waitFor(() => {
            expect(toggleNodeDescMock).toHaveBeenCalledTimes(1);
        });
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
