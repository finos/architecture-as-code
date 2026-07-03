import { Link } from 'react-router-dom';
import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';
import { CountBadge } from './CountBadge.js';

interface RailItemProps {
    label: string;
    count: number;
    active: boolean;
    /** Router target. Active state is derived from the URL, never local-only state. */
    to: string;
}

/**
 * A single browse-rail row: label left, right-aligned {@link CountBadge}.
 * Renders as a router link so navigation is URL-backed. Active rows use the
 * brand tint with an inset left accent.
 */
export function RailItem({ label, count, active, to }: RailItemProps) {
    const style = active
        ? {
              backgroundColor: colors.redesign.tintBg,
              color: colors.redesign.activeText,
              boxShadow: redesignTokens.shadow.railAccent,
              transition: redesignTokens.transition,
          }
        : { color: colors.redesign.bodyAlt, transition: redesignTokens.transition };

    return (
        <Link
            to={to}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-[7px] text-[13px] no-underline hover:bg-base-200 ${
                active ? 'font-semibold' : ''
            }`}
            style={style}
        >
            <span className="min-w-0 truncate">{label}</span>
            <CountBadge count={count} active={active} />
        </Link>
    );
}
