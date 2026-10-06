import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MotionToggleButton } from './MotionToggleButton.js';
import { createMotionStore, MOTION_STORAGE_KEY } from '../../../theme/useMotion.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';

describe('MotionToggleButton', () => {
    it('offers to pause while animation is running', () => {
        const store = createMotionStore(createMemoryStorage(), undefined);
        render(<MotionToggleButton store={store} />);

        const button = screen.getByRole('button', { name: 'Pause animation' });
        expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('pauses, persists the choice and offers to resume', () => {
        const storage = createMemoryStorage();
        const store = createMotionStore(storage, undefined);
        render(<MotionToggleButton store={store} />);

        fireEvent.click(screen.getByRole('button', { name: 'Pause animation' }));

        expect(screen.getByRole('button', { name: 'Resume animation' })).toHaveAttribute('aria-pressed', 'true');
        expect(storage.getItem(MOTION_STORAGE_KEY)).toBe('reduced');
        expect(document.documentElement.getAttribute('data-motion')).toBe('reduced');
    });

    it('starts paused when a paused choice is already stored', () => {
        const storage = createMemoryStorage();
        storage.setItem(MOTION_STORAGE_KEY, 'reduced');
        render(<MotionToggleButton store={createMotionStore(storage, undefined)} />);

        expect(screen.getByRole('button', { name: 'Resume animation' })).toBeInTheDocument();
    });

    it('resumes animation on a second click', () => {
        const storage = createMemoryStorage();
        const store = createMotionStore(storage, undefined);
        render(<MotionToggleButton store={store} />);

        fireEvent.click(screen.getByRole('button', { name: 'Pause animation' }));
        fireEvent.click(screen.getByRole('button', { name: 'Resume animation' }));

        expect(screen.getByRole('button', { name: 'Pause animation' })).toBeInTheDocument();
        expect(storage.getItem(MOTION_STORAGE_KEY)).toBe('full');
    });
});
