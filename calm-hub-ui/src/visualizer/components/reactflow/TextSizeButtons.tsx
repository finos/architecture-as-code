import { ControlButton } from 'reactflow';
import { THEME } from './theme.js';
import { useDiagramTextScale, type DiagramTextScaleStore } from '../../../theme/useDiagramTextScale.js';

interface TextSizeButtonsProps {
    /** Injected for tests; defaults to the app-wide store. */
    store?: DiagramTextScaleStore;
}

// React Flow dims only the svg of a disabled button, not text.
function labelStyle(enabled: boolean) {
    return { fontSize: 13, fontWeight: 700, color: THEME.colors.muted, lineHeight: 1, opacity: enabled ? 1 : 0.4 };
}

export function TextSizeButtons({ store }: TextSizeButtonsProps) {
    const { canGrow, canShrink, grow, shrink } = useDiagramTextScale(store);

    return (
        <>
            <ControlButton
                onClick={grow}
                disabled={!canGrow}
                title="Larger diagram text"
                aria-label="Larger diagram text"
            >
                <span style={labelStyle(canGrow)}>A+</span>
            </ControlButton>
            <ControlButton
                onClick={shrink}
                disabled={!canShrink}
                title="Smaller diagram text"
                aria-label="Smaller diagram text"
            >
                <span style={labelStyle(canShrink)}>A−</span>
            </ControlButton>
        </>
    );
}
