import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EdgeBadge, getBadgeStyle } from './EdgeBadge';
import { THEME } from '../theme';

describe('EdgeBadge', () => {
    const mockOnMouseEnter = vi.fn();
    const mockOnMouseLeave = vi.fn();
    const defaultBadgeStyle = getBadgeStyle(false, false);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders info icon when no flow info or AIGF', () => {
        const { container } = render(
            <EdgeBadge
                hasFlowInfo={false}
                hasAIGF={false}
                badgeStyle={defaultBadgeStyle}
                onMouseEnter={mockOnMouseEnter}
                onMouseLeave={mockOnMouseLeave}
            />
        );
        // The Info icon (lucide-react) renders as an SVG
        const svg = container.querySelector('svg');
        expect(svg).toBeTruthy();
        expect(svg?.classList.contains('lucide-info')).toBe(true);
    });

    it('calls onMouseEnter when hovered', () => {
        const { container } = render(
            <EdgeBadge
                hasFlowInfo={false}
                hasAIGF={false}
                badgeStyle={defaultBadgeStyle}
                onMouseEnter={mockOnMouseEnter}
                onMouseLeave={mockOnMouseLeave}
            />
        );
        const badge = container.firstChild as HTMLElement;
        fireEvent.mouseEnter(badge);
        expect(mockOnMouseEnter).toHaveBeenCalled();
    });

    it('calls onMouseLeave when mouse leaves', () => {
        const { container } = render(
            <EdgeBadge
                hasFlowInfo={false}
                hasAIGF={false}
                badgeStyle={defaultBadgeStyle}
                onMouseEnter={mockOnMouseEnter}
                onMouseLeave={mockOnMouseLeave}
            />
        );
        const badge = container.firstChild as HTMLElement;
        fireEvent.mouseLeave(badge);
        expect(mockOnMouseLeave).toHaveBeenCalled();
    });

    it('applies correct badge style', () => {
        const customStyle = {
            background: '#ff0000',
            border: '#00ff00',
            iconColor: '#0000ff',
        };
        const { container } = render(
            <EdgeBadge
                hasFlowInfo={false}
                hasAIGF={false}
                badgeStyle={customStyle}
                onMouseEnter={mockOnMouseEnter}
                onMouseLeave={mockOnMouseLeave}
            />
        );
        const badge = container.firstChild as HTMLElement;
        // Browser converts hex to rgb format
        expect(badge.style.background).toBe('rgb(255, 0, 0)');
        expect(badge.style.borderColor).toBe('rgb(0, 255, 0)');
    });
});

describe('getBadgeStyle', () => {
    it('returns accent colors when hasFlowInfo is true', () => {
        const style = getBadgeStyle(true, false);
        expect(style.border).toBe(THEME.colors.accent);
        expect(style.iconColor).toBe(THEME.colors.accent);
    });

    it('returns success colors when hasAIGF is true and no flow info', () => {
        const style = getBadgeStyle(false, true);
        expect(style.border).toBe(THEME.colors.success);
        expect(style.iconColor).toBe(THEME.colors.success);
    });

    it('returns muted colors when neither hasFlowInfo nor hasAIGF', () => {
        const style = getBadgeStyle(false, false);
        expect(style.border).toBe(THEME.colors.muted);
        expect(style.iconColor).toBe(THEME.colors.muted);
    });

    it('prioritizes flow info over AIGF', () => {
        const style = getBadgeStyle(true, true);
        expect(style.border).toBe(THEME.colors.accent);
    });
});
