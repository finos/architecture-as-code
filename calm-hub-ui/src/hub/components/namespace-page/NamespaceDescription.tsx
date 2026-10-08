import { useLayoutEffect, useRef, useState } from 'react';
import { colors } from '../../../theme/colors.js';
import { useIsMobile } from '../../../hooks/useMediaQuery.js';

interface NamespaceDescriptionProps {
    description: string;
}

/**
 * The namespace description under the page title, clamped to two lines. Desktop shows the
 * full text as a tooltip. Touch screens have no hover, so mobile gets a toggle instead,
 * shown only when the clamp actually cuts the text off.
 */
export function NamespaceDescription({ description }: NamespaceDescriptionProps) {
    const isMobile = useIsMobile();
    const textRef = useRef<HTMLParagraphElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [clamped, setClamped] = useState(false);

    useLayoutEffect(() => {
        const el = textRef.current;
        if (el && !expanded) setClamped(el.scrollHeight > el.clientHeight);
    }, [description, expanded, isMobile]);

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
        <div className="mt-2 ml-14">
            <p
                ref={textRef}
                data-testid="namespace-description"
                className={`text-[14px] ${expanded ? '' : 'line-clamp-2'}`}
                style={{ color: colors.redesign.muted }}
            >
                {description}
            </p>
            {(clamped || expanded) && (
                <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((e) => !e)}
                    className="mt-1 text-[13px] font-medium bg-transparent border-0 p-0 cursor-pointer"
                    style={{ color: colors.redesign.primaryText }}
                >
                    {expanded ? 'Show less' : 'Show more'}
                </button>
            )}
        </div>
    );
}
