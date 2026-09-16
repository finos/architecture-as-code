import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NestedCountBadge } from './NestedCountBadge.js';
import { colors } from '../../../theme/colors.js';

describe('NestedCountBadge', () => {
    it('renders a plus-prefixed count', () => {
        render(<NestedCountBadge count={8} />);
        expect(screen.getByTestId('nested-count-badge')).toHaveTextContent('+8');
    });

    it('renders with the faint badge treatment', () => {
        render(<NestedCountBadge count={3} />);
        const badge = screen.getByTestId('nested-count-badge');
        expect(badge).toHaveStyle({ backgroundColor: colors.redesign.badgeBgFaint, color: colors.redesign.disabled });
    });
});
