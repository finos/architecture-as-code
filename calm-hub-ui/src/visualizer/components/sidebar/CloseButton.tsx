import type { MouseEvent } from 'react';
import { IoCloseOutline } from 'react-icons/io5';

interface CloseButtonProps {
    onClick: (e: MouseEvent<HTMLButtonElement>) => void;
    /** Accessible label; defaults to "Close details" (shared by the mobile sheet and desktop sidebar). */
    label?: string;
}

/**
 * Shared close affordance for the node/edge details panels — the mobile bottom-sheet
 * and the desktop sidebar — so the icon, `type="button"` and screen-reader label stay
 * consistent across both.
 */
export function CloseButton({ onClick, label = 'Close details' }: CloseButtonProps) {
    return (
        <button type="button" aria-label={label} onClick={onClick} className="btn btn-ghost btn-xs btn-circle">
            <IoCloseOutline size={20} />
        </button>
    );
}
