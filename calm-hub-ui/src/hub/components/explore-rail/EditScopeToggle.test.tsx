import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditScopeToggle } from './EditScopeToggle.js';
import { colors } from '../../../theme/colors.js';

describe('EditScopeToggle', () => {
    it('marks the selected option as pressed', () => {
        render(<EditScopeToggle scope="editable" onChange={vi.fn()} />);
        const canEdit = screen.getByRole('button', { name: 'Can edit' });
        expect(canEdit).toHaveAttribute('aria-pressed', 'true');
        expect(canEdit).toHaveStyle({ backgroundColor: colors.redesign.tintBg });
        expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('reports the option the user clicks', () => {
        const onChange = vi.fn();
        render(<EditScopeToggle scope="all" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: 'Can edit' }));
        expect(onChange).toHaveBeenCalledWith('editable');
    });
});
