import { type ReactNode } from 'react';
import { IoFileTrayOutline } from 'react-icons/io5';
import { colors } from '../../../theme/colors.js';

interface EmptyStateProps {
    /** The line explaining what's empty, e.g. "No patterns in this namespace yet". */
    message: string;
    /** Optional icon override; defaults to an empty-tray glyph. */
    icon?: ReactNode;
    /** Optional call-to-action rendered below the message. */
    cta?: ReactNode;
}

/**
 * Centered empty-state shown in the card grid area when the active resource type
 * has no items. Distinguishes "empty" (a real, valid state) from "broken" — the
 * zero-count tab stays visible and selectable and lands here.
 */
export function EmptyState({ message, icon, cta }: EmptyStateProps) {
    return (
        <div
            data-testid="empty-state"
            className="flex flex-col items-center justify-center text-center py-16 gap-3"
        >
            <span style={{ color: colors.redesign.disabled }} aria-hidden="true">
                {icon ?? <IoFileTrayOutline size={40} />}
            </span>
            <p className="text-[14px]" style={{ color: colors.redesign.muted }}>
                {message}
            </p>
            {cta}
        </div>
    );
}
