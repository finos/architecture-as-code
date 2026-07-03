import { useRef } from 'react';
import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';
import { CountBadge } from '../explore-rail/CountBadge.js';
import { useIsMobile } from '../../../hooks/useMediaQuery.js';
import { type NamespaceResourceType, tabId, TYPE_PANEL_ID } from './resource-type-meta.js';

export interface TypeTab {
    type: NamespaceResourceType;
    /**
     * Per-type item count, or `undefined` while the namespace counts are still
     * loading — distinguishing "unknown" from a known zero so a loading tab renders
     * resting rather than dimmed.
     */
    count: number | undefined;
}

interface SegmentedTypeTabsProps {
    /** Tabs in display order, each with its per-type count. */
    types: TypeTab[];
    /** Currently selected type (URL-backed by the parent). */
    active: NamespaceResourceType;
    onSelect: (type: NamespaceResourceType) => void;
}

/**
 * Underline-style tab bar for the namespace browse types, implementing the ARIA
 * tabs pattern: a `tablist` of `tab` buttons (each `aria-controls` the single grid
 * panel), roving tabindex, and Left/Right arrow-key navigation (wrapping) that
 * moves selection. Each tab is a label + {@link CountBadge}. Active = blue text +
 * 2px blue underline sitting on the divider + filled badge. Resting = body text +
 * grey badge. Known zero-count = dimmed (disabled text + faint badge) but still
 * visible and selectable, so an empty type reads differently from a broken one;
 * while counts are loading (`count === undefined`) tabs render resting, not dimmed.
 * Keyboard focus shows a brand-coloured focus-visible ring. On mobile the bar
 * scrolls horizontally rather than wrapping; desktop is unchanged.
 */
export function SegmentedTypeTabs({ types, active, onSelect }: SegmentedTypeTabsProps) {
    const isMobile = useIsMobile();
    const tabRefs = useRef<Partial<Record<NamespaceResourceType, HTMLButtonElement | null>>>({});

    const moveSelection = (offset: number) => {
        const index = types.findIndex((t) => t.type === active);
        if (index === -1) return;
        const next = types[(index + offset + types.length) % types.length].type;
        onSelect(next);
        tabRefs.current[next]?.focus();
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            moveSelection(1);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            moveSelection(-1);
        }
    };

    return (
        <div
            role="tablist"
            aria-label="Resource types"
            className={`flex gap-1.5 ${isMobile ? 'overflow-x-auto flex-nowrap' : ''}`}
            style={{ borderBottom: `1px solid ${colors.redesign.tabDivider}` }}
        >
            {types.map(({ type, count }) => {
                const isActive = type === active;
                const isZero = count === 0;
                const color = isActive
                    ? colors.redesign.activeText
                    : isZero
                      ? colors.redesign.disabled
                      : colors.redesign.bodyAlt;

                return (
                    <button
                        key={type}
                        ref={(el) => {
                            tabRefs.current[type] = el;
                        }}
                        type="button"
                        role="tab"
                        id={tabId(type)}
                        aria-selected={isActive}
                        aria-controls={TYPE_PANEL_ID}
                        tabIndex={isActive ? 0 : -1}
                        data-testid={`type-tab-${type}`}
                        onClick={() => onSelect(type)}
                        onKeyDown={onKeyDown}
                        className={`flex items-center gap-[7px] px-[14px] py-[9px] text-[13.5px] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-interaction)] ${
                            isActive ? 'font-semibold' : ''
                        }`}
                        style={{
                            color,
                            borderBottom: isActive ? `2px solid ${colors.redesign.primary}` : '2px solid transparent',
                            marginBottom: '-1px',
                            transition: redesignTokens.transition,
                        }}
                    >
                        {type}
                        {/* While counts load (`count === undefined`) render no badge at
                            all rather than a literal "0", so a loading tab never flashes a
                            premature zero — the badge appears only once the real count
                            (including a genuine 0, which stays dimmed) arrives. */}
                        {count !== undefined && (
                            <CountBadge count={count} active={isActive} dimmed={!isActive && isZero} />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
