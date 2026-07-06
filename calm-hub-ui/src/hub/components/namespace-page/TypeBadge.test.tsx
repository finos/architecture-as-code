import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TypeBadge } from './TypeBadge.js';
import { colors } from '../../../theme/colors.js';

describe('TypeBadge', () => {
    it('renders the singular label for a plural UI type', () => {
        render(<TypeBadge type="Architectures" />);
        expect(screen.getByTestId('type-badge')).toHaveTextContent('Architecture');
    });

    it('renders the ADR label without re-pluralising', () => {
        render(<TypeBadge type="ADRs" />);
        expect(screen.getByTestId('type-badge')).toHaveTextContent('ADR');
    });

    it('uses the resource-type accent text and tint background', () => {
        render(<TypeBadge type="Patterns" />);
        const badge = screen.getByTestId('type-badge');
        expect(badge).toHaveStyle({ color: colors.resourceTypes.pattern.accent });
        expect(badge).toHaveStyle({ backgroundColor: colors.resourceTypes.pattern.tint });
    });

    it('colours interfaces with the interface accent (not architecture blue)', () => {
        render(<TypeBadge type="Interfaces" />);
        expect(screen.getByTestId('type-badge')).toHaveStyle({
            color: colors.resourceTypes.interface.accent,
        });
    });
});
