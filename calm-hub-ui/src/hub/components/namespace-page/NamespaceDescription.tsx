import { colors } from '../../../theme/colors.js';
import { useIsMobile } from '../../../hooks/useMediaQuery.js';
import { useClampToggle } from '../show-more/useClampToggle.js';
import { ShowMoreToggle } from '../show-more/ShowMoreToggle.js';

interface NamespaceDescriptionProps {
    description: string;
}

/**
 * The namespace description under the page title, clamped to two lines. Desktop shows the
 * full text as a tooltip. Touch screens have no hover, so mobile gets a toggle instead.
 */
export function NamespaceDescription({ description }: NamespaceDescriptionProps) {
    const isMobile = useIsMobile();
    const { ref, expanded, showToggle, toggle } = useClampToggle<HTMLParagraphElement>(description, isMobile);

    if (!isMobile) {
        return (
            <p
                data-testid="namespace-description"
                title={description}
                className="mt-2 ml-14 text-[14px] line-clamp-2"
                style={{ color: colors.redesign.muted }}
            >
                {description}
            </p>
        );
    }

    return (
        <div className="mt-2 ml-14 flex flex-col">
            <p
                ref={ref}
                data-testid="namespace-description"
                className={`text-[14px] ${expanded ? '' : 'line-clamp-2'}`}
                style={{ color: colors.redesign.muted }}
            >
                {description}
            </p>
            {showToggle && <ShowMoreToggle expanded={expanded} onToggle={toggle} />}
        </div>
    );
}
