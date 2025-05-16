import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Menu } from './Menu.js';
import { ZoomContext } from '../zoom-context.provider.js';

describe('Menu', () => {
    const handleUploadMock = vi.fn();
    const toggleConnectionDescMock = vi.fn();
    const toggleNodeDescMock = vi.fn();

    const renderMenu = (isGraphRendered = true, zoomLevel = 1) => {
        return render(
            <ZoomContext.Provider value={{ zoomLevel, updateZoom: vi.fn() }}>
                <Menu
                    handleUpload={handleUploadMock}
                    isGraphRendered={isGraphRendered}
                    toggleConnectionDesc={toggleConnectionDescMock}
                    toggleNodeDesc={toggleNodeDescMock}
                    isConDescActive={true}
                    isNodeDescActive={true}
                />
            </ZoomContext.Provider>
        );
    };

    it('should render Menu', () => {
        renderMenu();
        expect(screen.getByText('Relationship Descriptions')).toBeInTheDocument();
        expect(screen.getByText('Node Descriptions')).toBeInTheDocument();
        expect(screen.getByText('Zoom: 100%')).toBeInTheDocument();
        expect(screen.getByText('Upload')).toBeInTheDocument();
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
        const input = screen.getByLabelText('Architecture');
        const user = userEvent.setup();
        await user.upload(input, file);
        await waitFor(() => {
            expect(handleUploadMock).toHaveBeenCalledWith(file);
        });
    });

    it('should update zoom level on zoom in and zoom out buttons click', async () => {
        const updateZoomMock = vi.fn();
        render(
            <ZoomContext.Provider value={{ zoomLevel: 1, updateZoom: updateZoomMock }}>
                <Menu
                    handleUpload={handleUploadMock}
                    isGraphRendered={true}
                    toggleConnectionDesc={toggleConnectionDescMock}
                    toggleNodeDesc={toggleNodeDescMock}
                />
            </ZoomContext.Provider>
        );

        const zoomInButton = screen.getByText('+');
        const zoomOutButton = screen.getByText('-');

        fireEvent.click(zoomInButton);
        await waitFor(() => {
            expect(updateZoomMock).toHaveBeenCalledWith(1.1);
        });

        fireEvent.click(zoomOutButton);
        await waitFor(() => {
            expect(updateZoomMock).toHaveBeenCalledWith(0.9);
        });
    });
});
