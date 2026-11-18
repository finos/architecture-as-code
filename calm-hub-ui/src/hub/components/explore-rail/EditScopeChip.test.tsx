import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditScopeChip } from './EditScopeChip.js';

describe('EditScopeChip', () => {
    it('shows the active filter and clears it', () => {
        const onClear = vi.fn();
        render(<EditScopeChip onClear={onClear} />);
        expect(screen.getByText('Can edit')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Clear the Can edit filter' }));
        expect(onClear).toHaveBeenCalledTimes(1);
    });
});
