import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Menu', () => {
    const handleUploadMock = vi.fn();
    const toggleConnectionDescMock = vi.fn();
    const toggleNodeDescMock = vi.fn();

    const setup = () => {
        return render(
            <Menu
                handleUpload={handleUploadMock}
                toggleConnectionDesc={toggleConnectionDescMock}
                toggleNodeDesc={toggleNodeDescMock}
                isGraphRendered={true}
            />
        );
    };

    it('should render Menu', async () => {
        setup();
        expect(screen.getByRole('checkbox', { name: 'connection-description' })).not.toBeChecked();
    });

    it('should call toggleConnectionDesc on checkbox click', async () => {
        const user = userEvent.setup();
        setup();
        const checkbox = screen.getByRole('checkbox', { name: 'connection-description' });
        await user.click(checkbox);
        await waitFor(() => {
            expect(toggleConnectionDescMock).toHaveBeenCalledTimes(1);
        });
    });
    it('should call toggleNodeDesc on checkbox click', async () => {
        const user = userEvent.setup();
        setup();
        const checkbox = screen.getByRole('checkbox', { name: 'node-description' });
        await user.click(checkbox);
        await waitFor(() => {
            expect(toggleNodeDescMock).toHaveBeenCalledTimes(1);
        });
    });

    it('should call handleUpload on file input change', async () => {
        const user = userEvent.setup();
        setup();
        const file = new File(['example content'], 'example.txt', { type: 'text/plain' });
        const input = screen.getByLabelText('Architecture');
        await user.upload(input, file);
        await waitFor(() => {
            expect(handleUploadMock).toHaveBeenCalledWith(file);
        });
    });
});
