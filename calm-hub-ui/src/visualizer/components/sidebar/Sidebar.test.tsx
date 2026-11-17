import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Sidebar } from './Sidebar.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';

describe('Sidebar Component', () => {
    const panel = (storage = createMemoryStorage(), hidden = false) => (
        <Sidebar id="inspector" label="Inspector" hidden={hidden} storage={storage}>
            <input aria-label="Draft" />
        </Sidebar>
    );

    it('shows its content in a labelled region', () => {
        render(panel());

        expect(screen.getByRole('complementary', { name: 'Inspector' })).toHaveAttribute('id', 'inspector');
        expect(screen.getByRole('textbox', { name: 'Draft' })).toBeInTheDocument();
    });

    it('keeps its content mounted while it is hidden, so state in it stays', () => {
        const storage = createMemoryStorage();
        const { rerender } = render(panel(storage));
        fireEvent.change(screen.getByRole('textbox', { name: 'Draft' }), { target: { value: 'kept' } });

        rerender(panel(storage, true));
        expect(screen.queryByRole('complementary', { name: 'Inspector' })).not.toBeInTheDocument();

        rerender(panel(storage));
        expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('kept');
    });

    describe('resizing', () => {
        const panelWidth = (container: HTMLElement) => (container.firstChild as HTMLElement).style.getPropertyValue('--details-width');

        it('widens the panel when its handle is dragged left, and keeps the width when it is opened again', () => {
            const storage = createMemoryStorage();
            const { container, unmount } = render(panel(storage));
            const handle = screen.getByRole('separator', { name: 'Resize Inspector' });
            fireEvent.pointerDown(handle, { clientX: 900, pointerId: 1 });
            fireEvent.pointerMove(handle, { clientX: 800, pointerId: 1 });
            fireEvent.pointerUp(handle, { clientX: 800, pointerId: 1 });
            expect(panelWidth(container)).toBe('484px');
            unmount();

            const reopened = render(panel(storage));
            expect(panelWidth(reopened.container)).toBe('484px');
        });

        it('does not shrink below its minimum, and moving the pointer without a drag does nothing', () => {
            const { container } = render(panel());
            const handle = screen.getByRole('separator', { name: 'Resize Inspector' });
            fireEvent.pointerMove(handle, { clientX: 100, pointerId: 1 });
            expect(panelWidth(container)).toBe('384px');
            fireEvent.pointerDown(handle, { clientX: 500, pointerId: 1 });
            fireEvent.pointerMove(handle, { clientX: 900, pointerId: 1 });
            expect(panelWidth(container)).toBe('320px');
        });

        it('resizes with the arrow keys', () => {
            const { container } = render(panel());
            const handle = screen.getByRole('separator', { name: 'Resize Inspector' });
            fireEvent.keyDown(handle, { key: 'ArrowLeft' });
            expect(panelWidth(container)).toBe('416px');
        });
    });
});
