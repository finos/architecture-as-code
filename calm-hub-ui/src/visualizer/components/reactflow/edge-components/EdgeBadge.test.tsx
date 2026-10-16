import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { EdgeBadge } from './EdgeBadge.js';
import { getBadgeStyle } from '../utils/edgeBadge.utils.js';
import { THEME } from '../theme.js';

describe('EdgeBadge', () => {
    const mockOnMouseEnter = vi.fn();
    const mockOnMouseLeave = vi.fn();
    const flowBadgeStyle = getBadgeStyle(true);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the arrow icon for flow info', () => {
        const { container } = render(
            <EdgeBadge hasFlowInfo badgeStyle={flowBadgeStyle} />
        );
        expect(container.querySelector('svg')?.classList.contains('lucide-arrow-right')).toBe(true);
    });

    it('renders the shield icon for AIGF metadata', () => {
        const { container } = render(
            <EdgeBadge hasFlowInfo={false} badgeStyle={getBadgeStyle(false)} />
        );
        expect(container.querySelector('svg')?.classList.contains('lucide-shield')).toBe(true);
    });

    it('calls onMouseEnter when hovered', () => {
        const { container } = render(
            <EdgeBadge
                hasFlowInfo
                badgeStyle={flowBadgeStyle}
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
                hasFlowInfo
                badgeStyle={flowBadgeStyle}
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
                hasFlowInfo
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
        const style = getBadgeStyle(true);
        expect(style.border).toBe(THEME.colors.accent);
        expect(style.iconColor).toBe(THEME.colors.accent);
    });

    it('returns success colors when hasAIGF is true and no flow info', () => {
        const style = getBadgeStyle(false);
        expect(style.border).toBe(THEME.colors.success);
        expect(style.iconColor).toBe(THEME.colors.success);
    });
});
