import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TextSizeButtons } from './TextSizeButtons.js';
import { createDiagramTextScaleStore, DIAGRAM_TEXT_SCALE_KEY } from '../../../theme/useDiagramTextScale.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';

function storeAt(stored?: string) {
    const storage = createMemoryStorage();
    if (stored) storage.setItem(DIAGRAM_TEXT_SCALE_KEY, stored);
    return createDiagramTextScaleStore(storage);
}

describe('TextSizeButtons', () => {
    it('labels the buttons A− and A+', () => {
        render(<TextSizeButtons store={storeAt()} />);

        expect(screen.getByRole('button', { name: 'Smaller diagram text' })).toHaveTextContent('A−');
        expect(screen.getByRole('button', { name: 'Larger diagram text' })).toHaveTextContent('A+');
    });

    it('puts A+ above A−', () => {
        render(<TextSizeButtons store={storeAt()} />);

        expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['A+', 'A−']);
    });

    it('makes the diagram text larger', () => {
        const store = storeAt();
        render(<TextSizeButtons store={store} />);

        fireEvent.click(screen.getByRole('button', { name: 'Larger diagram text' }));

        expect(store.getSnapshot()).toBe(1.15);
    });

    it('makes the diagram text smaller', () => {
        const store = storeAt();
        render(<TextSizeButtons store={store} />);

        fireEvent.click(screen.getByRole('button', { name: 'Smaller diagram text' }));

        expect(store.getSnapshot()).toBe(0.9);
    });

    it('disables the larger button at the largest size', () => {
        render(<TextSizeButtons store={storeAt('1.5')} />);

        expect(screen.getByRole('button', { name: 'Larger diagram text' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Smaller diagram text' })).toBeEnabled();
    });

    it('dims the label of a disabled button', () => {
        render(<TextSizeButtons store={storeAt('1.5')} />);

        expect(screen.getByText('A+')).toHaveStyle({ opacity: '0.4' });
        expect(screen.getByText('A−')).toHaveStyle({ opacity: '1' });
    });

    it('disables the smaller button at the smallest size', () => {
        render(<TextSizeButtons store={storeAt('0.8')} />);

        expect(screen.getByRole('button', { name: 'Smaller diagram text' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Larger diagram text' })).toBeEnabled();
    });
});
