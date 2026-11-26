import { PanelRightOpen } from 'lucide-react';
import { colors } from '../../../theme/colors.js';

interface InspectorHandleProps {
    open: boolean;
    controls: string;
    onToggle: () => void;
}

/**
 * The handle on the right edge of the diagram that pulls out the inspector. It stays in the page while the inspector
 * is open, hidden, so focus can go back to it when the inspector closes.
 */
export function InspectorHandle({ open, controls, onToggle }: InspectorHandleProps) {
    return (
        <button
            type="button"
            hidden={open}
            aria-expanded={open}
            aria-controls={controls}
            title="Open the inspector"
            onClick={onToggle}
            className="relative self-start mt-14 z-10 flex w-11 shrink-0 min-h-36 items-center gap-1.5 rounded-l-lg border border-r-0 border-base-300 bg-base-100 px-2 py-3 text-sm font-semibold shadow-md [writing-mode:vertical-rl] hover:bg-(--calm-redesign-tint-bg) focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[var(--color-interaction)]"
            style={{ color: colors.redesign.primaryText }}
        >
            <PanelRightOpen size={16} aria-hidden="true" />
            <span>Details &amp; extensions</span>
        </button>
    );
}
