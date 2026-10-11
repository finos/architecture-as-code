import { ControlButton } from 'reactflow';
import { Pause, Play } from 'lucide-react';
import { THEME } from './theme.js';
import { colors } from '../../../theme/colors.js';
import { useMotion, type MotionStore } from '../../../theme/useMotion.js';

interface MotionToggleButtonProps {
    /** Injected for tests; defaults to the app-wide store. */
    store?: MotionStore;
}

/** Pauses diagram animation. Animated edges repaint every frame, which can overload remote desktops. */
export function MotionToggleButton({ store }: MotionToggleButtonProps) {
    const { motion, toggleMotion } = useMotion(store);
    const paused = motion === 'reduced';
    const label = paused ? 'Resume animation' : 'Pause animation';
    const Icon = paused ? Play : Pause;

    return (
        <ControlButton onClick={toggleMotion} title={label} aria-label={label} aria-pressed={paused}>
            <Icon size={14} color={paused ? colors.redesign.primaryText : THEME.colors.muted} />
        </ControlButton>
    );
}
