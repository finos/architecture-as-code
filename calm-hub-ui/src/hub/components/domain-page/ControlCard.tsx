import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import { colors } from '../../../theme/colors.js';
import { ItemCard } from '../namespace-page/ItemCard.js';

interface ControlCardProps {
    name: string;
    description?: string;
    /** The control's numeric id, shown as the mono footer meta (`#5`). */
    controlId: number;
    /** Whether this control's detail panel is currently open (selected styling). */
    active?: boolean;
    /** Activates the card — opens the control's detail panel. */
    onActivate: () => void;
}

/**
 * A browse card for a single control in a domain. Reuses {@link ItemCard} (the shared
 * striped-thumbnail / name / clamped-description / footer anatomy and full-card click)
 * rather than re-implementing it, so the control grid can't drift from the namespace
 * item cards.
 *
 * Control-specific bits are passed through: the `Controls` type paints the blue
 * thumbnail + "Control" pill, a shield glyph marks the header, the mono footer shows
 * the control id (`#5`), and `active` drives the selected treatment + `aria-pressed`.
 */
export function ControlCard({ name, description, controlId, active = false, onActivate }: ControlCardProps) {
    return (
        <ItemCard
            name={name}
            description={description}
            type="Controls"
            meta={`#${controlId}`}
            thumbnailIcon={
                <IoShieldCheckmarkOutline
                    size={30}
                    // Same control-type accent the striped header and pill use, so the
                    // shield can't drift if the control colours are adjusted independently.
                    style={{ color: colors.resourceTypes.control.accentText, opacity: 0.55 }}
                />
            }
            active={active}
            testId="control-card"
            onActivate={onActivate}
        />
    );
}
