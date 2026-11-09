import { ControlButton } from 'reactflow';
import { AArrowDown, AArrowUp } from 'lucide-react';
import { THEME } from './theme.js';
import { useDiagramTextScale, type DiagramTextScaleStore } from '../../../theme/useDiagramTextScale.js';

interface TextSizeButtonsProps {
    /** Injected for tests; defaults to the app-wide store. */
    store?: DiagramTextScaleStore;
}

export function TextSizeButtons({ store }: TextSizeButtonsProps) {
    const { canGrow, canShrink, grow, shrink } = useDiagramTextScale(store);

    return (
        <>
            <ControlButton
                onClick={shrink}
                disabled={!canShrink}
                title="Smaller diagram text"
                aria-label="Smaller diagram text"
            >
                <AArrowDown size={14} color={THEME.colors.muted} />
            </ControlButton>
            <ControlButton
                onClick={grow}
                disabled={!canGrow}
                title="Larger diagram text"
                aria-label="Larger diagram text"
            >
                <AArrowUp size={14} color={THEME.colors.muted} />
            </ControlButton>
        </>
    );
}
